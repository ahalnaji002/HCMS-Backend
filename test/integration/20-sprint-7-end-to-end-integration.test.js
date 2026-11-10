const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertActiveAssignment,
  insertTreatmentPlan,
  insertTreatmentMedication,
  getPrimaryNgoProfile,
  localDateTimeString,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Sprint 7 End-to-End Integration
registerIntegrationHooks();

test("registered Patient Emergency Alert completes its cross-role end-to-end workflow", async () => {
  const patientAuthorization = `Bearer ${tokenFor(users.patient)}`;
  const adminAuthorization = `Bearer ${tokenFor(users.admin)}`;
  const doctorAuthorization = `Bearer ${tokenFor(users.doctor)}`;

  const creation = await request(app)
    .post("/api/patient/emergency-alerts")
    .set("Authorization", patientAuthorization)
    .send({
      phone: "0593333333",
      location: "Gaza",
      description: "Integrated Patient emergency",
    });
  assert.equal(creation.status, 201);
  const alertId = creation.body.data.emergency_alert.id;
  assert.equal(
    creation.body.data.emergency_alert.patient_id,
    users.patientProfile.id,
  );
  assert.equal(creation.body.data.emergency_alert.status, "PENDING_ASSIGNMENT");

  const [patientList, patientDetail, adminList, adminDetail] =
    await Promise.all([
      request(app)
        .get("/api/patient/emergency-alerts")
        .set("Authorization", patientAuthorization),
      request(app)
        .get(`/api/patient/emergency-alerts/${alertId}`)
        .set("Authorization", patientAuthorization),
      request(app)
        .get("/api/admin/emergency-alerts")
        .set("Authorization", adminAuthorization),
      request(app)
        .get(`/api/admin/emergency-alerts/${alertId}`)
        .set("Authorization", adminAuthorization),
    ]);
  for (const response of [patientList, patientDetail, adminList, adminDetail]) {
    assert.equal(response.status, 200);
  }
  assert.ok(
    patientList.body.data.emergency_alerts.some(
      (alert) => alert.id === alertId,
    ),
  );
  assert.equal(patientDetail.body.data.emergency_alert.id, alertId);
  assert.ok(
    adminList.body.data.emergency_alerts.some((alert) => alert.id === alertId),
  );
  assert.equal(adminDetail.body.data.emergency_alert.id, alertId);

  const assignment = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", adminAuthorization)
    .send({ doctor_id: users.doctorProfile.id });
  assert.equal(assignment.status, 200);
  assert.equal(assignment.body.data.emergency_alert.id, alertId);
  assert.equal(
    assignment.body.data.emergency_alert.assigned_doctor_id,
    users.doctorProfile.id,
  );
  assert.equal(
    assignment.body.data.emergency_alert.assigned_by_admin_id,
    users.admin.id,
  );
  assert.ok(assignment.body.data.emergency_alert.assigned_at);

  const inProgress = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alertId}/status`)
    .set("Authorization", doctorAuthorization)
    .send({ status: "IN_PROGRESS" });
  assert.equal(inProgress.status, 200);
  assert.equal(inProgress.body.data.emergency_alert.id, alertId);
  assert.ok(inProgress.body.data.emergency_alert.responded_at);
  assert.equal(inProgress.body.data.emergency_alert.resolved_at, null);

  const resolved = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alertId}/status`)
    .set("Authorization", doctorAuthorization)
    .send({ status: "RESOLVED" });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.data.emergency_alert.id, alertId);
  assert.equal(resolved.body.data.emergency_alert.status, "RESOLVED");
  assert.equal(
    new Date(resolved.body.data.emergency_alert.responded_at).getTime(),
    new Date(inProgress.body.data.emergency_alert.responded_at).getTime(),
  );
  assert.ok(resolved.body.data.emergency_alert.resolved_at);

  const finalPatientDetail = await request(app)
    .get(`/api/patient/emergency-alerts/${alertId}`)
    .set("Authorization", patientAuthorization);
  const patientNotifications = await request(app)
    .get("/api/notifications")
    .set("Authorization", patientAuthorization);
  const unreadCount = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", patientAuthorization);
  assert.equal(finalPatientDetail.status, 200);
  assert.equal(finalPatientDetail.body.data.emergency_alert.id, alertId);
  assert.equal(finalPatientDetail.body.data.emergency_alert.status, "RESOLVED");
  assert.equal(patientNotifications.status, 200);
  assert.equal(patientNotifications.body.data.notifications.length, 2);
  assert.ok(
    patientNotifications.body.data.notifications.every(
      (notification) =>
        notification.user_id === users.patient.id &&
        notification.type === "EMERGENCY_ALERT" &&
        notification.reference_type === "EMERGENCY_ALERT" &&
        notification.reference_id === alertId,
    ),
  );
  assert.deepEqual(
    patientNotifications.body.data.notifications
      .map((notification) => notification.message)
      .sort(),
    [
      `Emergency Alert #${alertId} is now IN_PROGRESS.`,
      `Emergency Alert #${alertId} is now RESOLVED.`,
    ].sort(),
  );
  assert.equal(unreadCount.status, 200);
  assert.equal(unreadCount.body.data.unread_count, 2);

  const allNotifications = await db("notifications")
    .where({ reference_type: "EMERGENCY_ALERT", reference_id: alertId })
    .orderBy("id", "asc");
  assert.equal(allNotifications.length, 3);
  assert.deepEqual(
    allNotifications.map((notification) => String(notification.user_id)),
    [users.doctor.id, users.patient.id, users.patient.id].map(String),
  );
  assert.ok(
    allNotifications.every(
      (notification) =>
        notification.type === "EMERGENCY_ALERT" &&
        notification.reference_type === "EMERGENCY_ALERT" &&
        notification.reference_id === alertId,
    ),
  );

  const logs = await db("activity_logs").orderBy("id", "asc");
  assert.deepEqual(
    logs.map((log) => [log.action, String(log.user_id), String(log.entity_id)]),
    [
      ["ASSIGN_EMERGENCY_ALERT", users.admin.id, alertId],
      ["UPDATE_EMERGENCY_STATUS", users.doctor.id, alertId],
      ["UPDATE_EMERGENCY_STATUS", users.doctor.id, alertId],
    ].map(([action, userId, entityId]) => [
      action,
      String(userId),
      String(entityId),
    ]),
  );
});

test("Assistance Request and Resource Allocation complete one cross-role end-to-end workflow", async () => {
  await insertActiveAssignment();
  const patientAuthorization = `Bearer ${tokenFor(users.patient)}`;
  const doctorAuthorization = `Bearer ${tokenFor(users.doctor)}`;
  const adminAuthorization = `Bearer ${tokenFor(users.admin)}`;
  const ngoAuthorization = `Bearer ${tokenFor(users.ngo)}`;
  const ngo = await getPrimaryNgoProfile();
  const privateDescription = "Integrated private Assistance description";
  const privateNotes = "Integrated private allocation notes";

  const creation = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .set("Authorization", doctorAuthorization)
    .send({
      request_type: "Medical supplies",
      description: privateDescription,
    });
  assert.equal(creation.status, 201);
  const assistanceRequestId = creation.body.data.assistance_request.id;
  assert.equal(
    creation.body.data.assistance_request.patient_id,
    users.patientProfile.id,
  );
  assert.equal(
    creation.body.data.assistance_request.doctor_id,
    users.doctorProfile.id,
  );
  assert.equal(creation.body.data.assistance_request.ngo_id, null);
  assert.equal(creation.body.data.assistance_request.status, "PENDING");

  const patientRead = await request(app)
    .get(`/api/patient/assistance-requests/${assistanceRequestId}`)
    .set("Authorization", patientAuthorization);
  assert.equal(patientRead.status, 200);
  assert.equal(
    patientRead.body.data.assistance_request.id,
    assistanceRequestId,
  );

  const assignment = await request(app)
    .patch(`/api/admin/assistance-requests/${assistanceRequestId}/assign`)
    .set("Authorization", adminAuthorization)
    .send({ ngo_id: ngo.id });
  assert.equal(assignment.status, 200);
  assert.equal(assignment.body.data.assistance_request.id, assistanceRequestId);
  assert.equal(assignment.body.data.assistance_request.ngo_id, ngo.id);

  const ngoRead = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequestId}`)
    .set("Authorization", ngoAuthorization);
  assert.equal(ngoRead.status, 200);
  assert.equal(ngoRead.body.data.assistance_request.id, assistanceRequestId);

  for (const status of ["UNDER_REVIEW", "APPROVED"]) {
    const transition = await request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequestId}/status`)
      .set("Authorization", ngoAuthorization)
      .send({ status });
    assert.equal(transition.status, 200);
    assert.equal(transition.body.data.assistance_request.id, assistanceRequestId);
    assert.equal(transition.body.data.assistance_request.status, status);
  }

  const resourceCreation = await request(app)
    .post(`/api/ngo/assistance-requests/${assistanceRequestId}/resources`)
    .set("Authorization", ngoAuthorization)
    .send({
      resource_name: "Integrated medical supplies",
      quantity: 2,
      delivery_date: "2026-10-01",
      notes: privateNotes,
    });
  assert.equal(resourceCreation.status, 201);
  const resourceId = resourceCreation.body.data.resource_allocation.id;
  assert.equal(
    resourceCreation.body.data.resource_allocation.assistance_request_id,
    assistanceRequestId,
  );

  const resourceUpdate = await request(app)
    .patch(
      `/api/ngo/assistance-requests/${assistanceRequestId}/resources/${resourceId}`,
    )
    .set("Authorization", ngoAuthorization)
    .send({ quantity: 4, notes: "Updated integrated notes" });
  assert.equal(resourceUpdate.status, 200);
  assert.equal(resourceUpdate.body.data.resource_allocation.id, resourceId);
  assert.equal(resourceUpdate.body.data.resource_allocation.quantity, 4);

  const completion = await request(app)
    .patch(`/api/ngo/assistance-requests/${assistanceRequestId}/status`)
    .set("Authorization", ngoAuthorization)
    .send({ status: "COMPLETED" });
  assert.equal(completion.status, 200);
  assert.equal(completion.body.data.assistance_request.id, assistanceRequestId);
  assert.equal(completion.body.data.assistance_request.status, "COMPLETED");

  const resourcePaths = [
    [patientAuthorization, `/api/patient/assistance-requests/${assistanceRequestId}/resources`],
    [doctorAuthorization, `/api/doctor/assistance-requests/${assistanceRequestId}/resources`],
    [ngoAuthorization, `/api/ngo/assistance-requests/${assistanceRequestId}/resources`],
    [adminAuthorization, `/api/admin/assistance-requests/${assistanceRequestId}/resources`],
  ];
  for (const [authorization, path] of resourcePaths) {
    const response = await request(app)
      .get(path)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.resource_allocations.length, 1);
    assert.equal(response.body.data.resource_allocations[0].id, resourceId);
    assert.equal(
      response.body.data.resource_allocations[0].assistance_request_id,
      assistanceRequestId,
    );
  }

  const rejectedUpdate = await request(app)
    .patch(
      `/api/ngo/assistance-requests/${assistanceRequestId}/resources/${resourceId}`,
    )
    .set("Authorization", ngoAuthorization)
    .send({ quantity: 5 });
  const rejectedDelete = await request(app)
    .delete(
      `/api/ngo/assistance-requests/${assistanceRequestId}/resources/${resourceId}`,
    )
    .set("Authorization", ngoAuthorization);
  assert.equal(rejectedUpdate.status, 409);
  assert.equal(rejectedDelete.status, 409);

  const storedRequest = await db("assistance_requests")
    .where({ id: assistanceRequestId })
    .first();
  const storedResource = await db("resource_allocations")
    .where({ id: resourceId })
    .first();
  assert.equal(storedRequest.status, "COMPLETED");
  assert.equal(storedRequest.ngo_id, ngo.id);
  assert.equal(storedResource.assistance_request_id, assistanceRequestId);
  assert.equal(storedResource.quantity, 4);

  const notifications = await db("notifications")
    .where({
      reference_type: "ASSISTANCE_REQUEST",
      reference_id: assistanceRequestId,
    })
    .orderBy("id", "asc");
  assert.equal(notifications.length, 6);
  for (const status of ["UNDER_REVIEW", "APPROVED", "COMPLETED"]) {
    const matching = notifications.filter(
      (notification) =>
        notification.message ===
        `Assistance Request #${assistanceRequestId} is now ${status}.`,
    );
    assert.equal(matching.length, 2);
    assert.deepEqual(
      matching.map((notification) => String(notification.user_id)).sort(),
      [users.patient.id, users.doctor.id].map(String).sort(),
    );
    assert.ok(
      matching.every(
        (notification) =>
          notification.type === "ASSISTANCE_REQUEST" &&
          notification.reference_type === "ASSISTANCE_REQUEST" &&
          notification.reference_id === assistanceRequestId,
      ),
    );
  }

  const logs = await db("activity_logs").orderBy("id", "asc");
  assert.deepEqual(
    logs.map((log) => [log.action, String(log.user_id), String(log.entity_id)]),
    [
      ["CREATE_ASSISTANCE_REQUEST", users.doctor.id, assistanceRequestId],
      ["UPDATE_ASSISTANCE_STATUS", users.ngo.id, assistanceRequestId],
      ["UPDATE_ASSISTANCE_STATUS", users.ngo.id, assistanceRequestId],
      ["CREATE_RESOURCE_ALLOCATION", users.ngo.id, resourceId],
      ["UPDATE_RESOURCE_ALLOCATION", users.ngo.id, resourceId],
      ["UPDATE_ASSISTANCE_STATUS", users.ngo.id, assistanceRequestId],
    ].map(([action, userId, entityId]) => [
      action,
      String(userId),
      String(entityId),
    ]),
  );
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes(privateDescription), false);
  assert.equal(serializedLogs.includes(privateNotes), false);
  assert.equal(serializedLogs.includes("Updated integrated notes"), false);
});

test("Visitor Emergency Alert completes without fabricated Patient status Notifications", async () => {
  const adminAuthorization = `Bearer ${tokenFor(users.admin)}`;
  const doctorAuthorization = `Bearer ${tokenFor(users.doctor)}`;

  const creation = await request(app).post("/api/emergency-alerts").send({
    phone: "0595555555",
    location: "Gaza",
    description: "Integrated Visitor emergency",
  });
  assert.equal(creation.status, 201);
  const alertId = creation.body.data.emergency_alert.id;
  assert.equal(creation.body.data.emergency_alert.patient_id, null);

  const adminDetail = await request(app)
    .get(`/api/admin/emergency-alerts/${alertId}`)
    .set("Authorization", adminAuthorization);
  assert.equal(adminDetail.status, 200);
  assert.equal(adminDetail.body.data.emergency_alert.id, alertId);

  const assignment = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", adminAuthorization)
    .send({ doctor_id: users.doctorProfile.id });
  assert.equal(assignment.status, 200);
  assert.equal(assignment.body.data.emergency_alert.patient_id, null);
  assert.equal(
    assignment.body.data.emergency_alert.assigned_doctor_id,
    users.doctorProfile.id,
  );

  for (const status of ["IN_PROGRESS", "RESOLVED"]) {
    const transition = await request(app)
      .patch(`/api/doctor/emergency-alerts/${alertId}/status`)
      .set("Authorization", doctorAuthorization)
      .send({ status });
    assert.equal(transition.status, 200);
    assert.equal(transition.body.data.emergency_alert.id, alertId);
    assert.equal(transition.body.data.emergency_alert.patient_id, null);
    assert.equal(transition.body.data.emergency_alert.status, status);
  }

  const storedAlert = await db("emergency_alerts").where({ id: alertId }).first();
  assert.equal(storedAlert.patient_id, null);
  assert.equal(storedAlert.assigned_doctor_id, users.doctorProfile.id);
  assert.equal(storedAlert.status, "RESOLVED");
  assert.ok(storedAlert.assigned_at);
  assert.ok(storedAlert.responded_at);
  assert.ok(storedAlert.resolved_at);

  const notifications = await db("notifications").where({
    reference_type: "EMERGENCY_ALERT",
    reference_id: alertId,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.doctor.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alertId);
  assert.equal(notifications[0].title, "Emergency Alert assigned");

  const logs = await db("activity_logs").orderBy("id", "asc");
  assert.deepEqual(
    logs.map((log) => [log.action, String(log.user_id), String(log.entity_id)]),
    [
      ["ASSIGN_EMERGENCY_ALERT", users.admin.id, alertId],
      ["UPDATE_EMERGENCY_STATUS", users.doctor.id, alertId],
      ["UPDATE_EMERGENCY_STATUS", users.doctor.id, alertId],
    ].map(([action, userId, entityId]) => [
      action,
      String(userId),
      String(entityId),
    ]),
  );
});

test("Patient Reminder flows from API creation through delivery and Notification read", async () => {
  const reminderService = require("../../src/services/reminderService");
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);
  const patientAuthorization = `Bearer ${tokenFor(users.patient)}`;

  const creation = await request(app)
    .post("/api/patient/reminders")
    .set("Authorization", patientAuthorization)
    .send({
      type: "MEDICATION",
      reference_id: String(medication.id),
      remind_at: localDateTimeString(3600),
    });
  assert.equal(creation.status, 201);
  const reminderId = creation.body.data.reminder.id;
  assert.equal(creation.body.data.reminder.user_id, users.patient.id);
  assert.equal(creation.body.data.reminder.reference_id, medication.id);
  assert.equal(creation.body.data.reminder.status, "PENDING");
  assert.equal(creation.body.data.reminder.sent_at, null);

  await db("reminders").where({ id: reminderId }).update({
    remind_at: localDateTimeString(-60).replace("T", " "),
  });

  const firstDelivery = await reminderService.deliverDueReminders(new Date());
  assert.equal(firstDelivery.length, 1);
  assert.equal(firstDelivery[0].id, reminderId);

  const storedReminder = await db("reminders")
    .where({ id: reminderId })
    .first();
  assert.equal(storedReminder.status, "SENT");
  assert.ok(storedReminder.sent_at);

  const notificationList = await request(app)
    .get("/api/notifications")
    .set("Authorization", patientAuthorization);
  assert.equal(notificationList.status, 200);
  assert.equal(notificationList.body.data.notifications.length, 1);
  const notification = notificationList.body.data.notifications[0];
  assert.equal(notification.user_id, users.patient.id);
  assert.equal(notification.type, "REMINDER");
  assert.equal(notification.reference_type, "REMINDER");
  assert.equal(notification.reference_id, reminderId);
  assert.equal(notification.is_read, 0);

  const unreadBefore = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", patientAuthorization);
  assert.equal(unreadBefore.status, 200);
  assert.equal(unreadBefore.body.data.unread_count, 1);

  const read = await request(app)
    .patch(`/api/notifications/${notification.id}/read`)
    .set("Authorization", patientAuthorization)
    .send({});
  assert.equal(read.status, 200);
  assert.equal(read.body.data.notification.id, notification.id);
  assert.equal(read.body.data.notification.is_read, 1);
  assert.ok(read.body.data.notification.read_at);

  const unreadAfter = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", patientAuthorization);
  assert.equal(unreadAfter.status, 200);
  assert.equal(unreadAfter.body.data.unread_count, 0);

  const secondDelivery = await reminderService.deliverDueReminders(new Date());
  assert.equal(secondDelivery.length, 0);
  const storedNotifications = await db("notifications").where({
    reference_type: "REMINDER",
    reference_id: reminderId,
  });
  assert.equal(storedNotifications.length, 1);
  assert.equal(storedNotifications[0].is_read, 1);
  assert.ok(storedNotifications[0].read_at);
});
