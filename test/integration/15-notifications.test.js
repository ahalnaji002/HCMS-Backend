const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertActiveAssignment,
  createSecondDoctor,
  insertTreatmentPlan,
  insertDoctorEmergencyAlert,
  insertAssistanceRequest,
  getPrimaryNgoProfile,
  insertResourceAllocation,
  insertNotification,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Notifications
registerIntegrationHooks();

test("Notification APIs require authentication", async () => {
  for (const [method, path] of [
    ["get", "/api/notifications"],
    ["get", "/api/notifications/unread-count"],
    ["patch", "/api/notifications/1/read"],
    ["patch", "/api/notifications/read-all"],
  ]) {
    const response = await request(app)[method](path).send(
      method === "patch" ? {} : undefined,
    );

    assert.equal(response.status, 401);
  }
});

test("all authenticated roles list only their own Notifications", async () => {
  for (const currentUser of [
    users.patient,
    users.doctor,
    users.ngo,
    users.admin,
  ]) {
    await insertNotification(currentUser.id, {
      title: `${currentUser.role} notification`,
    });
  }

  for (const currentUser of [
    users.patient,
    users.doctor,
    users.ngo,
    users.admin,
  ]) {
    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.notifications.length, 1);
    assert.equal(
      response.body.data.notifications[0].user_id,
      currentUser.id,
    );
    assert.equal(
      response.body.data.notifications[0].title,
      `${currentUser.role} notification`,
    );

    const unreadResponse = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
    const readResponse = await request(app)
      .patch(
        `/api/notifications/${response.body.data.notifications[0].id}/read`,
      )
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
      .send({});

    assert.equal(unreadResponse.status, 200);
    assert.equal(unreadResponse.body.data.unread_count, 1);
    assert.equal(readResponse.status, 200);
  }
});

test("Notification list is deterministic newest-first and exposes safe schema fields", async () => {
  const older = await insertNotification(users.patient.id, {
    title: "Older",
    created_at: "2026-09-25 09:00:00",
  });
  const tiedFirst = await insertNotification(users.patient.id, {
    title: "Tied first",
    created_at: "2026-09-26 09:00:00",
  });
  const tiedSecond = await insertNotification(users.patient.id, {
    title: "Tied second",
    created_at: "2026-09-26 09:00:00",
  });

  const response = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.notifications.map((notification) => notification.id),
    [tiedSecond.id, tiedFirst.id, older.id],
  );
  assert.deepEqual(
    Object.keys(response.body.data.notifications[0]).sort(),
    [
      "created_at",
      "id",
      "is_read",
      "message",
      "read_at",
      "reference_id",
      "reference_type",
      "title",
      "type",
      "user_id",
    ],
  );
});

test("unread count is scoped to the authenticated user", async () => {
  await insertNotification(users.patient.id);
  await insertNotification(users.patient.id, {
    is_read: true,
    read_at: "2026-09-26 10:00:00",
  });
  await insertNotification(users.doctor.id);

  const patientResponse = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const doctorResponse = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(patientResponse.status, 200);
  assert.equal(patientResponse.body.data.unread_count, 1);
  assert.equal(doctorResponse.status, 200);
  assert.equal(doctorResponse.body.data.unread_count, 1);
});

test("Notification owner marks read idempotently while preserving read_at", async () => {
  const notification = await insertNotification(users.patient.id);
  const path = `/api/notifications/${notification.id}/read`;
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const first = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({});
  const second = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({});

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.notification.is_read, 1);
  assert.ok(first.body.data.notification.read_at);
  assert.equal(
    new Date(second.body.data.notification.read_at).getTime(),
    new Date(first.body.data.notification.read_at).getTime(),
  );
});

test("non-owners cannot discover or mark another user's Notification", async () => {
  const notification = await insertNotification(users.patient.id);

  for (const currentUser of [users.doctor, users.ngo, users.admin]) {
    const response = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
      .send({});

    assert.equal(response.status, 404);
    assert.equal(response.body.message, "Notification not found");
  }

  const stored = await db("notifications").where({ id: notification.id }).first();
  assert.equal(stored.is_read, 0);
  assert.equal(stored.read_at, null);
});

test("Notification read validates IDs and accepts no client fields", async () => {
  const notification = await insertNotification(users.patient.id);
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const malformed = await request(app)
    .patch("/api/notifications/not-an-id/read")
    .set("Authorization", authorization)
    .send({});
  const zero = await request(app)
    .patch("/api/notifications/0/read")
    .set("Authorization", authorization)
    .send({});
  const negative = await request(app)
    .patch("/api/notifications/-1/read")
    .set("Authorization", authorization)
    .send({});
  const outOfRange = await request(app)
    .patch("/api/notifications/18446744073709551616/read")
    .set("Authorization", authorization)
    .send({});
  const unknownField = await request(app)
    .patch(`/api/notifications/${notification.id}/read`)
    .set("Authorization", authorization)
    .send({ is_read: true });
  const missing = await request(app)
    .patch("/api/notifications/999999999/read")
    .set("Authorization", authorization)
    .send({});

  assert.equal(malformed.status, 400);
  assert.equal(zero.status, 400);
  assert.equal(negative.status, 400);
  assert.equal(outOfRange.status, 400);
  assert.equal(unknownField.status, 400);
  assert.equal(unknownField.body.errors.is_read, "is_read is not allowed");
  assert.equal(missing.status, 404);
});

test("read-all marks only the current user's unread Notifications", async () => {
  const patientUnread = await insertNotification(users.patient.id);
  const patientRead = await insertNotification(users.patient.id, {
    is_read: true,
    read_at: "2026-09-25 08:00:00",
  });
  const doctorUnread = await insertNotification(users.doctor.id);

  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.updated_count, 1);

  const [storedPatientUnread, storedPatientRead, storedDoctorUnread] =
    await Promise.all([
      db("notifications").where({ id: patientUnread.id }).first(),
      db("notifications").where({ id: patientRead.id }).first(),
      db("notifications").where({ id: doctorUnread.id }).first(),
    ]);

  assert.equal(storedPatientUnread.is_read, 1);
  assert.ok(storedPatientUnread.read_at);
  assert.equal(
    new Date(storedPatientRead.read_at).getTime(),
    new Date(patientRead.read_at).getTime(),
  );
  assert.equal(storedDoctorUnread.is_read, 0);
  assert.equal(storedDoctorUnread.read_at, null);
});

test("read-all rejects non-empty request bodies", async () => {
  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({ user_id: users.doctor.id });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors.user_id, "user_id is not allowed");
});

test("internal Notification references accept only existing approved entities", async () => {
  const notificationService = require("../../src/services/notificationService");
  const assistanceRequest = await insertAssistanceRequest();
  const alertId = (
    await db("emergency_alerts").insert({
      patient_id: users.patientProfile.id,
      phone: "0591111111",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    })
  )[0];
  const treatmentPlan = await insertTreatmentPlan();

  for (const [referenceType, referenceId] of [
    ["ASSISTANCE_REQUEST", assistanceRequest.id],
    ["EMERGENCY_ALERT", alertId],
    ["TREATMENT_PLAN", treatmentPlan.id],
  ]) {
    const entity = await notificationService.validateReference(
      referenceType,
      String(referenceId),
    );
    assert.equal(String(entity.id), String(referenceId));
  }

  await assert.rejects(
    notificationService.validateReference("MESSAGE", "1"),
    notificationService.NotificationValidationError,
  );
  await assert.rejects(
    notificationService.validateReference("TREATMENT_PLAN", "999999999"),
    notificationService.NotificationNotFoundError,
  );
  await assert.rejects(
    notificationService.validateReference(
      "TREATMENT_PLAN",
      "18446744073709551616",
    ),
    notificationService.NotificationValidationError,
  );
  await assert.rejects(
    notificationService.validateReference(
      "TREATMENT_PLAN",
      Number.MAX_SAFE_INTEGER + 1,
    ),
    notificationService.NotificationValidationError,
  );
});

test("Emergency Alert assignment notifies exactly the assigned Doctor", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ doctor_id: users.doctorProfile.id });

  assert.equal(response.status, 200);
  const notifications = await db("notifications");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.doctor.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alertId);
});

test("Emergency Alert IN_PROGRESS transition notifies exactly the registered Patient", async () => {
  const alert = await insertDoctorEmergencyAlert();

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "IN_PROGRESS" });

  assert.equal(response.status, 200);

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);

  assert.equal(storedAlert.status, "IN_PROGRESS");
  assert.ok(storedAlert.responded_at);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alert.id);
});

test("Emergency Alert RESOLVED transition notifies exactly the registered Patient", async () => {
  const alert = await insertDoctorEmergencyAlert({
    status: "IN_PROGRESS",
    responded_at: "2026-09-25 10:00:00",
  });

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "RESOLVED" });

  assert.equal(response.status, 200);

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);

  assert.equal(storedAlert.status, "RESOLVED");
  assert.equal(storedAlert.responded_at.getTime(), alert.responded_at.getTime());
  assert.ok(storedAlert.resolved_at);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alert.id);
});

test("Visitor Emergency Alert Doctor transitions succeed without Notifications", async () => {
  for (const [currentStatus, nextStatus] of [
    ["ASSIGNED", "IN_PROGRESS"],
    ["IN_PROGRESS", "RESOLVED"],
  ]) {
    const alert = await insertDoctorEmergencyAlert({
      patient_id: null,
      status: currentStatus,
      responded_at:
        currentStatus === "IN_PROGRESS" ? "2026-09-25 10:00:00" : null,
    });

    const response = await request(app)
      .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ status: nextStatus });

    assert.equal(response.status, 200);

    const [storedAlert, notifications] = await Promise.all([
      db("emergency_alerts").where({ id: alert.id }).first(),
      db("notifications").where({
        reference_type: "EMERGENCY_ALERT",
        reference_id: alert.id,
      }),
    ]);
    assert.equal(storedAlert.status, nextStatus);
    assert.equal(notifications.length, 0);
  }
});

test("rejected Doctor Emergency Alert transitions create no Notifications", async () => {
  const otherDoctor = await createSecondDoctor();
  const wrongDoctorAlert = await insertDoctorEmergencyAlert();
  const invalidTransitionAlert = await insertDoctorEmergencyAlert();

  const wrongDoctorResponse = await request(app)
    .patch(`/api/doctor/emergency-alerts/${wrongDoctorAlert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(otherDoctor.user)}`)
    .send({ status: "IN_PROGRESS" });
  const invalidTransitionResponse = await request(app)
    .patch(`/api/doctor/emergency-alerts/${invalidTransitionAlert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "RESOLVED" });

  assert.equal(wrongDoctorResponse.status, 404);
  assert.equal(invalidTransitionResponse.status, 409);
  assert.equal((await db("notifications")).length, 0);
});

test("Emergency Alert Notification failures roll back both Doctor transitions", async () => {
  const notificationModel = require("../../src/models/notificationModel");
  const originalCreate = notificationModel.create;

  try {
    notificationModel.create = async () => {
      throw new Error("Injected Emergency Notification insert failure");
    };

    for (const [currentStatus, nextStatus] of [
      ["ASSIGNED", "IN_PROGRESS"],
      ["IN_PROGRESS", "RESOLVED"],
    ]) {
      const alert = await insertDoctorEmergencyAlert({
        status: currentStatus,
        responded_at:
          currentStatus === "IN_PROGRESS" ? "2026-09-25 10:00:00" : null,
        resolved_at: null,
        updated_at: "2026-01-01 00:00:00",
      });
      const originalRespondedAt = alert.responded_at?.getTime() ?? null;
      const originalResolvedAt = alert.resolved_at?.getTime() ?? null;
      const originalUpdatedAt = alert.updated_at.getTime();

      const response = await request(app)
        .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
        .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
        .send({ status: nextStatus });

      assert.equal(response.status, 500);

      const [storedAlert, notifications] = await Promise.all([
        db("emergency_alerts").where({ id: alert.id }).first(),
        db("notifications").where({
          reference_type: "EMERGENCY_ALERT",
          reference_id: alert.id,
        }),
      ]);

      assert.equal(storedAlert.status, currentStatus);
      assert.equal(storedAlert.responded_at?.getTime() ?? null, originalRespondedAt);
      assert.equal(storedAlert.resolved_at?.getTime() ?? null, originalResolvedAt);
      assert.equal(storedAlert.updated_at.getTime(), originalUpdatedAt);
      assert.equal(notifications.length, 0);
    }
  } finally {
    notificationModel.create = originalCreate;
  }
});

test("concurrent duplicate IN_PROGRESS transitions commit one Patient Notification", async () => {
  const alert = await insertDoctorEmergencyAlert();
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);
  assert.equal(storedAlert.status, "IN_PROGRESS");
  assert.ok(storedAlert.responded_at);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
});

test("concurrent duplicate RESOLVED transitions commit one additional Patient Notification", async () => {
  const alert = await insertDoctorEmergencyAlert({
    status: "IN_PROGRESS",
    responded_at: "2026-09-25 10:00:00",
  });
  await insertNotification(users.patient.id, {
    title: "Emergency Alert status updated",
    message: `Emergency Alert #${alert.id} is now IN_PROGRESS.`,
    type: "EMERGENCY_ALERT",
    reference_type: "EMERGENCY_ALERT",
    reference_id: alert.id,
  });
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "RESOLVED" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "RESOLVED" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);
  assert.equal(storedAlert.status, "RESOLVED");
  assert.equal(storedAlert.responded_at.getTime(), alert.responded_at.getTime());
  assert.ok(storedAlert.resolved_at);
  assert.equal(notifications.length, 2);
  assert.equal(
    notifications.filter((notification) =>
      notification.message.endsWith("is now RESOLVED."),
    ).length,
    1,
  );
});

test("Treatment Plan update notifies exactly the affected Patient", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ title: "Notification update" });

  assert.equal(response.status, 200);
  const notifications = await db("notifications");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "TREATMENT_PLAN");
  assert.equal(notifications[0].reference_type, "TREATMENT_PLAN");
  assert.equal(notifications[0].reference_id, plan.id);
});

test("each approved Assistance Request transition notifies Patient and submitting Doctor once", async () => {
  const ngo = await getPrimaryNgoProfile();

  for (const [currentStatus, nextStatus] of [
    ["PENDING", "UNDER_REVIEW"],
    ["UNDER_REVIEW", "APPROVED"],
    ["UNDER_REVIEW", "REJECTED"],
    ["APPROVED", "COMPLETED"],
  ]) {
    const assistanceRequest = await insertAssistanceRequest({
      ngo_id: ngo.id,
      status: currentStatus,
    });

    if (nextStatus === "COMPLETED") {
      await insertResourceAllocation(assistanceRequest.id);
    }

    const response = await request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
      .send({ status: nextStatus });

    assert.equal(response.status, 200);
    const notifications = await db("notifications").where({
      reference_type: "ASSISTANCE_REQUEST",
      reference_id: assistanceRequest.id,
    });
    assert.equal(notifications.length, 2);
    assert.deepEqual(
      notifications.map((notification) => notification.user_id).sort(),
      [users.patient.id, users.doctor.id].sort(),
    );
    assert.ok(
      notifications.every(
        (notification) => notification.type === "ASSISTANCE_REQUEST",
      ),
    );
  }
});

test("failed and repeated Assistance Request transitions create no duplicate Notifications", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/status`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const invalid = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "APPROVED" });
  assert.equal(invalid.status, 409);
  assert.equal((await db("notifications")).length, 0);

  const successful = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "UNDER_REVIEW" });
  const repeated = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "UNDER_REVIEW" });

  assert.equal(successful.status, 200);
  assert.equal(repeated.status, 409);
  assert.equal((await db("notifications")).length, 2);
});

test("Notification insertion failures roll back each integrated business mutation", async () => {
  const notificationModel = require("../../src/models/notificationModel");
  const originalCreate = notificationModel.create;
  const ngo = await getPrimaryNgoProfile();
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ title: "Original title" });
  let assistanceFailureIndex = null;
  let assistanceInsertCount = 0;
  let successfulAssistanceInserts = 0;

  try {
    notificationModel.create = async (notification, connection) => {
      if (notification.reference_type === "ASSISTANCE_REQUEST") {
        assistanceInsertCount += 1;

        if (assistanceInsertCount === assistanceFailureIndex) {
          throw new Error("Injected Notification insert failure");
        }

        const inserted = await originalCreate(notification, connection);
        successfulAssistanceInserts += 1;
        return inserted;
      }

      throw new Error("Injected Notification insert failure");
    };

    const emergencyResponse = await request(app)
      .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ doctor_id: users.doctorProfile.id });
    const treatmentResponse = await request(app)
      .patch(
        `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
      )
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ title: "Must roll back" });

    assert.equal(emergencyResponse.status, 500);
    assert.equal(treatmentResponse.status, 500);

    for (const failureIndex of [1, 2]) {
      const assistanceRequest = await insertAssistanceRequest({
        ngo_id: ngo.id,
      });
      const originalUpdatedAt = new Date(assistanceRequest.updated_at).getTime();
      assistanceFailureIndex = failureIndex;
      assistanceInsertCount = 0;
      successfulAssistanceInserts = 0;

      const assistanceResponse = await request(app)
        .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
        .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
        .send({ status: "UNDER_REVIEW" });

      assert.equal(assistanceResponse.status, 500);
      assert.equal(assistanceInsertCount, failureIndex);
      assert.equal(successfulAssistanceInserts, failureIndex - 1);

      const storedAssistanceRequest = await db("assistance_requests")
        .where({ id: assistanceRequest.id })
        .first();
      const storedNotifications = await db("notifications").where({
        reference_type: "ASSISTANCE_REQUEST",
        reference_id: assistanceRequest.id,
      });

      assert.equal(storedAssistanceRequest.status, "PENDING");
      assert.equal(storedAssistanceRequest.reviewed_at, null);
      assert.equal(
        new Date(storedAssistanceRequest.updated_at).getTime(),
        originalUpdatedAt,
      );
      assert.equal(storedNotifications.length, 0);
    }
  } finally {
    notificationModel.create = originalCreate;
  }

  const [storedAlert, storedPlan] = await Promise.all([
    db("emergency_alerts").where({ id: alertId }).first(),
    db("treatment_plans").where({ id: plan.id }).first(),
  ]);

  assert.equal(storedAlert.status, "PENDING_ASSIGNMENT");
  assert.equal(storedAlert.assigned_doctor_id, null);
  assert.equal(storedPlan.title, "Original title");
  assert.equal((await db("notifications")).length, 0);
});
