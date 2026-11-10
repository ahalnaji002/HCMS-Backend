const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  TEST_PASSWORD_HASH,
  users,
  createUser,
  tokenFor,
  insertActiveAssignment,
  insertDoctorEmergencyAlert,
  insertAssistanceRequest,
  getPrimaryNgoProfile,
  insertResourceAllocation,
  ACTIVITY_LOG_COLUMNS,
  insertActivityLog,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Activity Logs
registerIntegrationHooks();

test("Activity Log endpoints require ADMIN authentication", async () => {
  const activityLog = await insertActivityLog();
  const paths = [
    "/api/admin/activity-logs",
    `/api/admin/activity-logs/${activityLog.id}`,
  ];

  for (const path of paths) {
    assert.equal((await request(app).get(path)).status, 401);

    for (const currentUser of [users.patient, users.doctor, users.ngo]) {
      const response = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
      assert.equal(response.status, 403);
    }

    const admin = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`);
    assert.equal(admin.status, 200);
  }
});

test("Activity Log list supports deterministic pagination and empty pages", async () => {
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const empty = await request(app)
    .get("/api/admin/activity-logs")
    .set("Authorization", authorization);
  assert.deepEqual(empty.body.data, {
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });

  const older = await insertActivityLog({
    entity_id: "10",
    description: "Join Request #10 approved.",
    created_at: "2026-09-25 10:00:00",
  });
  const tiedFirst = await insertActivityLog({
    entity_id: "11",
    description: "Join Request #11 approved.",
    created_at: "2026-09-26 10:00:00",
  });
  const tiedSecond = await insertActivityLog({
    entity_id: "12",
    description: "Join Request #12 approved.",
    created_at: "2026-09-26 10:00:00",
  });

  const defaults = await request(app)
    .get("/api/admin/activity-logs")
    .set("Authorization", authorization);
  assert.equal(defaults.status, 200);
  assert.deepEqual(
    defaults.body.data.items.map((item) => item.id),
    [tiedSecond.id, tiedFirst.id, older.id],
  );
  assert.equal(defaults.body.data.page, 1);
  assert.equal(defaults.body.data.limit, 20);
  assert.equal(defaults.body.data.total, 3);
  assert.equal(defaults.body.data.total_pages, 1);

  const partial = await request(app)
    .get("/api/admin/activity-logs?page=2&limit=2")
    .set("Authorization", authorization);
  assert.equal(partial.status, 200);
  assert.deepEqual(partial.body.data.items.map((item) => item.id), [older.id]);
  assert.deepEqual(
    {
      page: partial.body.data.page,
      limit: partial.body.data.limit,
      total: partial.body.data.total,
      total_pages: partial.body.data.total_pages,
    },
    { page: 2, limit: 2, total: 3, total_pages: 2 },
  );

  const beyond = await request(app)
    .get("/api/admin/activity-logs?page=3&limit=2")
    .set("Authorization", authorization);
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.data.items, []);
  assert.equal(beyond.body.data.total, 3);
  assert.equal(beyond.body.data.total_pages, 2);
});

test("Activity Log pagination validates the derived offset boundary", async () => {
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const limit = 100;
  const largestSafePage = Math.floor(Number.MAX_SAFE_INTEGER / limit) + 1;
  const firstUnsafePage = largestSafePage + 1;

  const safeBoundary = await request(app)
    .get(`/api/admin/activity-logs?page=${largestSafePage}&limit=${limit}`)
    .set("Authorization", authorization);
  assert.equal(safeBoundary.status, 200);
  assert.deepEqual(safeBoundary.body.data.items, []);
  assert.equal(safeBoundary.body.data.page, largestSafePage);
  assert.equal(safeBoundary.body.data.limit, limit);

  const unsafeBoundary = await request(app)
    .get(`/api/admin/activity-logs?page=${firstUnsafePage}&limit=${limit}`)
    .set("Authorization", authorization);
  assert.equal(unsafeBoundary.status, 400);
  assert.equal(unsafeBoundary.body.success, false);
  assert.equal(
    unsafeBoundary.body.errors.page,
    "page and limit produce an unsafe pagination offset",
  );

  const samePageWithSafeLimit = await request(app)
    .get(`/api/admin/activity-logs?page=${firstUnsafePage}&limit=1`)
    .set("Authorization", authorization);
  assert.equal(samePageWithSafeLimit.status, 200);
  assert.deepEqual(samePageWithSafeLimit.body.data.items, []);
  assert.equal(samePageWithSafeLimit.body.data.page, firstUnsafePage);
  assert.equal(samePageWithSafeLimit.body.data.limit, 1);
});

test("Activity Log list validates and applies every approved filter", async () => {
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const first = await insertActivityLog({
    entity_id: "101",
    created_at: "2026-09-25 10:00:00",
  });
  const second = await insertActivityLog({
    user_id: users.doctor.id,
    action: "UPDATE_EMERGENCY_STATUS",
    entity_type: "EMERGENCY_ALERT",
    entity_id: "202",
    description: "Emergency Alert #202 status updated to IN_PROGRESS.",
    created_at: "2026-09-26 10:00:00",
  });

  for (const [query, expectedIds] of [
    [`user_id=${users.doctor.id}`, [second.id]],
    ["action=APPROVE_JOIN_REQUEST", [first.id]],
    ["entity_type=EMERGENCY_ALERT", [second.id]],
    ["entity_id=101", [first.id]],
    ["date_from=2026-09-26T00:00:00", [second.id]],
    ["date_to=2026-09-25T23:59:59", [first.id]],
    [
      "date_from=2026-09-25T00:00:00&date_to=2026-09-26T23:59:59",
      [second.id, first.id],
    ],
    [
      "user_id=" +
        users.doctor.id +
        "&action=UPDATE_EMERGENCY_STATUS&entity_type=EMERGENCY_ALERT&entity_id=202",
      [second.id],
    ],
    ["user_id=18446744073709551615", []],
  ]) {
    const response = await request(app)
      .get(`/api/admin/activity-logs?${query}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.items.map((item) => item.id),
      expectedIds,
    );
  }

  for (const query of [
    "page=0",
    "page=-1",
    "page=1.5",
    "limit=0",
    "limit=-1",
    "limit=1.5",
    "limit=101",
    "user_id=bad",
    "user_id=0",
    "user_id=-1",
    "user_id=1.5",
    "user_id=18446744073709551616",
    "entity_id=bad",
    "entity_id=0",
    "entity_id=-1",
    "entity_id=1.5",
    "entity_id=18446744073709551616",
    "action=UNKNOWN",
    "entity_type=USER",
    "date_from=2026-02-30T10:00:00",
    "date_to=2026-09-26T10:00:00Z",
    "date_from=2026-09-27T00:00:00&date_to=2026-09-26T00:00:00",
    "unknown=value",
  ]) {
    const response = await request(app)
      .get(`/api/admin/activity-logs?${query}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 400);
  }
});

test("Activity Log detail exposes safe fields and validates BIGINT IDs", async () => {
  const activityLog = await insertActivityLog();
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const detail = await request(app)
    .get(`/api/admin/activity-logs/${activityLog.id}`)
    .set("Authorization", authorization);

  assert.equal(detail.status, 200);
  assert.deepEqual(
    Object.keys(detail.body.data.activity_log).sort(),
    ACTIVITY_LOG_COLUMNS,
  );

  assert.equal(
    (
      await request(app)
        .get("/api/admin/activity-logs/999999999")
        .set("Authorization", authorization)
    ).status,
    404,
  );

  for (const logId of [
    "bad",
    "0",
    "-1",
    "1.5",
    "18446744073709551616",
  ]) {
    const response = await request(app)
      .get(`/api/admin/activity-logs/${logId}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 400);
  }

  const maximum = await request(app)
    .get("/api/admin/activity-logs/18446744073709551615")
    .set("Authorization", authorization);
  assert.equal(maximum.status, 404);
});

test("all nine approved workflows create exact safe Activity Logs", async () => {
  const adminAuthorization = `Bearer ${tokenFor(users.admin)}`;
  const doctorAuthorization = `Bearer ${tokenFor(users.doctor)}`;
  const ngoAuthorization = `Bearer ${tokenFor(users.ngo)}`;

  const pendingDoctor = await createUser({
    fullName: "Activity Pending Doctor",
    email: "activity.pending.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });
  await db("doctors").insert({
    user_id: pendingDoctor.id,
    specialization: "General Medicine",
    license_number: "ACTIVITY-PENDING-DOC",
  });
  const [approvalId] = await db("join_requests").insert({
    user_id: pendingDoctor.id,
    request_type: "DOCTOR",
  });
  assert.equal(
    (
      await request(app)
        .patch(`/api/admin/join-requests/${approvalId}/approve`)
        .set("Authorization", adminAuthorization)
        .send({})
    ).status,
    200,
  );

  const pendingNgo = await createUser({
    fullName: "Activity Pending NGO",
    email: "activity.pending.ngo@test.local",
    role: "NGO",
    accountStatus: "INACTIVE",
  });
  await db("ngos").insert({
    user_id: pendingNgo.id,
    organization_name: "Activity Pending NGO",
    registration_number: "ACTIVITY-PENDING-NGO",
  });
  const [rejectionId] = await db("join_requests").insert({
    user_id: pendingNgo.id,
    request_type: "NGO",
  });
  const rejectionSecret = "PRIVATE-REJECTION-REASON";
  assert.equal(
    (
      await request(app)
        .patch(`/api/admin/join-requests/${rejectionId}/reject`)
        .set("Authorization", adminAuthorization)
        .send({ rejection_reason: rejectionSecret })
    ).status,
    200,
  );

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0599999999",
    description: "PRIVATE-EMERGENCY-DESCRIPTION",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
  assert.equal(
    (
      await request(app)
        .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
        .set("Authorization", adminAuthorization)
        .send({ doctor_id: users.doctorProfile.id })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .patch(`/api/doctor/emergency-alerts/${alertId}/status`)
        .set("Authorization", doctorAuthorization)
        .send({ status: "IN_PROGRESS" })
    ).status,
    200,
  );

  await insertActiveAssignment();
  const assistanceSecret = "PRIVATE-ASSISTANCE-DESCRIPTION";
  const createdAssistance = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .set("Authorization", doctorAuthorization)
    .send({
      request_type: "Medical supplies",
      description: assistanceSecret,
    });
  assert.equal(createdAssistance.status, 201);
  const createdAssistanceId =
    createdAssistance.body.data.assistance_request.id;

  const ngo = await getPrimaryNgoProfile();
  const statusRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "PENDING",
  });
  assert.equal(
    (
      await request(app)
        .patch(`/api/ngo/assistance-requests/${statusRequest.id}/status`)
        .set("Authorization", ngoAuthorization)
        .send({ status: "UNDER_REVIEW" })
    ).status,
    200,
  );

  const resourceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const resourceSecret = "PRIVATE-RESOURCE-NOTES";
  const createdResource = await request(app)
    .post(`/api/ngo/assistance-requests/${resourceRequest.id}/resources`)
    .set("Authorization", ngoAuthorization)
    .send({
      resource_name: "Medical supplies",
      quantity: 2,
      notes: resourceSecret,
    });
  assert.equal(createdResource.status, 201);
  const resourceId = createdResource.body.data.resource_allocation.id;
  assert.equal(
    (
      await request(app)
        .patch(
          `/api/ngo/assistance-requests/${resourceRequest.id}/resources/${resourceId}`,
        )
        .set("Authorization", ngoAuthorization)
        .send({ quantity: 3 })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .delete(
          `/api/ngo/assistance-requests/${resourceRequest.id}/resources/${resourceId}`,
        )
        .set("Authorization", ngoAuthorization)
    ).status,
    200,
  );

  const logs = await db("activity_logs").orderBy("id", "asc");
  assert.deepEqual(
    logs.map((log) => [log.action, log.entity_type, String(log.entity_id)]),
    [
      ["APPROVE_JOIN_REQUEST", "JOIN_REQUEST", String(approvalId)],
      ["REJECT_JOIN_REQUEST", "JOIN_REQUEST", String(rejectionId)],
      ["ASSIGN_EMERGENCY_ALERT", "EMERGENCY_ALERT", String(alertId)],
      ["UPDATE_EMERGENCY_STATUS", "EMERGENCY_ALERT", String(alertId)],
      [
        "CREATE_ASSISTANCE_REQUEST",
        "ASSISTANCE_REQUEST",
        String(createdAssistanceId),
      ],
      [
        "UPDATE_ASSISTANCE_STATUS",
        "ASSISTANCE_REQUEST",
        String(statusRequest.id),
      ],
      [
        "CREATE_RESOURCE_ALLOCATION",
        "RESOURCE_ALLOCATION",
        String(resourceId),
      ],
      [
        "UPDATE_RESOURCE_ALLOCATION",
        "RESOURCE_ALLOCATION",
        String(resourceId),
      ],
      [
        "DELETE_RESOURCE_ALLOCATION",
        "RESOURCE_ALLOCATION",
        String(resourceId),
      ],
    ],
  );
  assert.deepEqual(
    logs.map((log) => log.description),
    [
      `Join Request #${approvalId} approved.`,
      `Join Request #${rejectionId} rejected.`,
      `Emergency Alert #${alertId} assigned.`,
      `Emergency Alert #${alertId} status updated to IN_PROGRESS.`,
      `Assistance Request #${createdAssistanceId} created.`,
      `Assistance Request #${statusRequest.id} status updated to UNDER_REVIEW.`,
      `Resource Allocation #${resourceId} created.`,
      `Resource Allocation #${resourceId} updated.`,
      `Resource Allocation #${resourceId} deleted.`,
    ],
  );
  assert.deepEqual(
    logs.map((log) => String(log.user_id)),
    [
      users.admin.id,
      users.admin.id,
      users.admin.id,
      users.doctor.id,
      users.doctor.id,
      users.ngo.id,
      users.ngo.id,
      users.ngo.id,
      users.ngo.id,
    ].map(String),
  );
  assert.ok(logs.every((log) => log.created_at));
  assert.ok(
    logs.every(
      (log) =>
        ["127.0.0.1", "::ffff:127.0.0.1"].includes(log.ip_address) &&
        log.ip_address.length <= 45,
    ),
  );

  const serializedLogs = JSON.stringify(logs);
  for (const sensitiveValue of [
    rejectionSecret,
    assistanceSecret,
    resourceSecret,
    "PRIVATE-EMERGENCY-DESCRIPTION",
    "0599999999",
    TEST_PASSWORD_HASH,
  ]) {
    assert.equal(serializedLogs.includes(sensitiveValue), false);
  }

  assert.equal(
    await db("resource_allocations").where({ id: resourceId }).first(),
    undefined,
  );
  const deleteLog = logs.find(
    (log) => log.action === "DELETE_RESOURCE_ALLOCATION",
  );
  const historicalDetail = await request(app)
    .get(`/api/admin/activity-logs/${deleteLog.id}`)
    .set("Authorization", adminAuthorization);
  assert.equal(historicalDetail.status, 200);
  assert.equal(historicalDetail.body.data.activity_log.entity_id, resourceId);
});

test("failed and unauthorized operations create no Activity Logs", async () => {
  const alert = await insertDoctorEmergencyAlert({ status: "ASSIGNED" });
  const invalidTransition = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "RESOLVED" });
  const unauthorized = await request(app)
    .get("/api/admin/activity-logs")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const missing = await request(app)
    .patch("/api/ngo/assistance-requests/999999999/status")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({ status: "UNDER_REVIEW" });

  assert.equal(invalidTransition.status, 409);
  assert.equal(unauthorized.status, 403);
  assert.equal(missing.status, 404);
  assert.equal((await db("activity_logs")).length, 0);
});

test("Activity Log failure rolls back Notification workflows and Resource deletion", async () => {
  const activityLogModel = require("../../src/models/activityLogModel");
  const originalCreate = activityLogModel.create;
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
    updated_at: "2026-01-01 00:00:00",
  });
  const originalAlert = await db("emergency_alerts").where({ id: alertId }).first();
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const allocation = await insertResourceAllocation(assistanceRequest.id);
  await insertActiveAssignment();
  const assistanceCountBefore = await db("assistance_requests")
    .count({ count: "id" })
    .first();

  try {
    activityLogModel.create = async () => {
      throw new Error("Injected Activity Log insert failure");
    };

    const assignment = await request(app)
      .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ doctor_id: users.doctorProfile.id });
    assert.equal(assignment.status, 500);

    const creation = await request(app)
      .post(
        `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
      )
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({
        request_type: "Medical supplies",
        description: "Must roll back with its Activity Log",
      });
    assert.equal(creation.status, 500);

    const deletion = await request(app)
      .delete(
        `/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`,
      )
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);
    assert.equal(deletion.status, 500);
  } finally {
    activityLogModel.create = originalCreate;
  }

  const storedAlert = await db("emergency_alerts").where({ id: alertId }).first();
  assert.equal(storedAlert.status, "PENDING_ASSIGNMENT");
  assert.equal(storedAlert.assigned_doctor_id, null);
  assert.equal(storedAlert.assigned_by_admin_id, null);
  assert.equal(storedAlert.assigned_at, null);
  assert.equal(
    storedAlert.updated_at.getTime(),
    originalAlert.updated_at.getTime(),
  );
  assert.ok(await db("resource_allocations").where({ id: allocation.id }).first());
  assert.equal(
    Number(
      (
        await db("assistance_requests").count({ count: "id" }).first()
      ).count,
    ),
    Number(assistanceCountBefore.count),
  );
  assert.equal((await db("activity_logs")).length, 0);
  assert.equal(
    (
      await db("notifications").where({
        reference_type: "EMERGENCY_ALERT",
        reference_id: alertId,
      })
    ).length,
    0,
  );
});

test("concurrent Assistance transitions commit one winning Activity Log", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "UNDER_REVIEW",
  });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/status`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;
  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "APPROVED" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "REJECTED" }),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );
  const successfulResponse = responses.find((response) => response.status === 200);

  const stored = await db("assistance_requests")
    .where({ id: assistanceRequest.id })
    .first();
  const logs = await db("activity_logs").where({
    action: "UPDATE_ASSISTANCE_STATUS",
    entity_id: assistanceRequest.id,
  });
  assert.ok(["APPROVED", "REJECTED"].includes(stored.status));
  assert.equal(
    successfulResponse.body.data.assistance_request.status,
    stored.status,
  );
  assert.equal(logs.length, 1);
  assert.equal(
    logs[0].description,
    `Assistance Request #${assistanceRequest.id} status updated to ${stored.status}.`,
  );
});
