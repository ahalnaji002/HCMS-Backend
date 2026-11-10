const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  createUser,
  tokenFor,
  insertActiveAssignment,
  insertAssistanceRequest,
  createSecondPatientForAssistanceRequests,
  getPrimaryNgoProfile,
  createAssistanceNgo,
  insertResourceAllocation,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Assistance Requests
registerIntegrationHooks();

test("Doctor can create an Assistance Request for an actively assigned Patient", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      request_type: "Medical supplies",
      description: "Patient requires a wheelchair",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  const assistanceRequest = response.body.data.assistance_request;

  assert.equal(assistanceRequest.patient_id, users.patientProfile.id);
  assert.equal(assistanceRequest.doctor_id, users.doctorProfile.id);
  assert.equal(assistanceRequest.ngo_id, null);
  assert.equal(assistanceRequest.status, "PENDING");
  assert.ok(assistanceRequest.submitted_at);

  const storedRequest = await db("assistance_requests")
    .where({ id: assistanceRequest.id })
    .first();

  assert.equal(storedRequest.patient_id, users.patientProfile.id);
  assert.equal(storedRequest.doctor_id, users.doctorProfile.id);
  assert.equal(storedRequest.ngo_id, null);
  assert.equal(storedRequest.status, "PENDING");
});

test("Doctor without an active assignment cannot create an Assistance Request", async () => {
  const response = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      request_type: "Food support",
      description: "Patient requires food support",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.message, "Active Doctor-Patient Assignment required");
  assert.equal(await db("assistance_requests").count({ count: "*" }).first().then((row) => Number(row.count)), 0);
});

test("Doctor cannot create an Assistance Request for another Patient", async () => {
  await insertActiveAssignment();
  const { patientProfile } = await createSecondPatientForAssistanceRequests();

  const response = await request(app)
    .post(`/api/doctor/patients/${patientProfile.id}/assistance-requests`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      request_type: "Shelter",
      description: "Patient requires shelter",
    });

  assert.equal(response.status, 403);
  assert.equal(await db("assistance_requests").where({ patient_id: patientProfile.id }).first(), undefined);
});

test("Assistance Request creation requires request_type and description", async () => {
  await insertActiveAssignment();
  const path = `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`;

  const missingRequestType = await request(app)
    .post(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ description: "Required description" });

  const missingDescription = await request(app)
    .post(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ request_type: "Medical supplies" });

  assert.equal(missingRequestType.status, 400);
  assert.equal(
    missingRequestType.body.errors.request_type,
    "request_type is required",
  );
  assert.equal(missingDescription.status, 400);
  assert.equal(
    missingDescription.body.errors.description,
    "description is required",
  );
});

test("Assistance Request creation rejects empty and invalid values", async () => {
  await insertActiveAssignment();
  const path = `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`;

  const emptyResponse = await request(app)
    .post(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ request_type: "   ", description: "   " });

  const invalidResponse = await request(app)
    .post(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ request_type: 7, description: false });

  assert.equal(emptyResponse.status, 400);
  assert.equal(
    emptyResponse.body.errors.request_type,
    "request_type must not be empty",
  );
  assert.equal(
    emptyResponse.body.errors.description,
    "description must not be empty",
  );
  assert.equal(invalidResponse.status, 400);
  assert.equal(
    invalidResponse.body.errors.request_type,
    "request_type must be a string",
  );
  assert.equal(
    invalidResponse.body.errors.description,
    "description must be a string",
  );
});

test("Assistance Request creation enforces database text limits", async () => {
  await insertActiveAssignment();
  const path = `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`;

  const response = await request(app)
    .post(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      request_type: "x".repeat(101),
      description: "ع".repeat(32768),
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.errors.request_type,
    "request_type must not exceed 100 characters",
  );
  assert.equal(
    response.body.errors.description,
    "description must not exceed 65535 bytes",
  );
});

test("Assistance Request creation rejects protected and unknown fields", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      request_type: "Medical supplies",
      description: "Patient requires support",
      patient_id: users.patientProfile.id,
      doctor_id: users.doctorProfile.id,
      ngo_id: 1,
      status: "APPROVED",
      submitted_at: "2026-09-26 10:00:00",
      reviewed_at: "2026-09-26 11:00:00",
      created_at: "2026-09-26 10:00:00",
      updated_at: "2026-09-26 10:00:00",
      unknown_field: true,
    });

  assert.equal(response.status, 400);

  for (const field of [
    "patient_id",
    "doctor_id",
    "ngo_id",
    "status",
    "submitted_at",
    "reviewed_at",
    "created_at",
    "updated_at",
    "unknown_field",
  ]) {
    assert.equal(response.body.errors[field], `${field} is not allowed`);
  }
});

test("Assistance Request creation rejects invalid Patient IDs", async () => {
  const invalidResponse = await request(app)
    .post("/api/doctor/patients/not-an-id/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ request_type: "Shelter", description: "Shelter required" });

  const outOfRangeResponse = await request(app)
    .post(
      "/api/doctor/patients/18446744073709551616/assistance-requests",
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ request_type: "Shelter", description: "Shelter required" });

  assert.equal(invalidResponse.status, 400);
  assert.equal(outOfRangeResponse.status, 400);
});

test("Patient can list only own Assistance Requests", async () => {
  const { patientProfile } = await createSecondPatientForAssistanceRequests();
  await insertAssistanceRequest({ description: "Own request" });
  await insertAssistanceRequest({
    patient_id: patientProfile.id,
    description: "Another Patient request",
  });

  const response = await request(app)
    .get("/api/patient/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.assistance_requests.length, 1);
  assert.equal(
    response.body.data.assistance_requests[0].patient_id,
    users.patientProfile.id,
  );
});

test("Patient can view own Assistance Request", async () => {
  const assistanceRequest = await insertAssistanceRequest();

  const response = await request(app)
    .get(`/api/patient/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(
    response.body.data.assistance_request.id,
    assistanceRequest.id,
  );
});

test("Patient cannot view another Patient's Assistance Request", async () => {
  const { patientProfile } = await createSecondPatientForAssistanceRequests();
  const assistanceRequest = await insertAssistanceRequest({
    patient_id: patientProfile.id,
  });

  const response = await request(app)
    .get(`/api/patient/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Assistance Request not found");
});

test("Patient Assistance Request detail returns 404 for a missing request", async () => {
  const response = await request(app)
    .get("/api/patient/assistance-requests/999999999")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Assistance Request not found");
});

test("Patient Assistance Request detail rejects invalid requestId", async () => {
  const invalidResponse = await request(app)
    .get("/api/patient/assistance-requests/not-an-id")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  const outOfRangeResponse = await request(app)
    .get("/api/patient/assistance-requests/18446744073709551616")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(invalidResponse.status, 400);
  assert.equal(outOfRangeResponse.status, 400);
});

test("Assistance Request endpoints reject wrong roles", async () => {
  const doctorResponse = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({ request_type: "Shelter", description: "Shelter required" });

  const patientResponse = await request(app)
    .get("/api/patient/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(doctorResponse.status, 403);
  assert.equal(patientResponse.status, 403);
});

test("Assistance Request endpoints require authentication", async () => {
  const createResponse = await request(app)
    .post(
      `/api/doctor/patients/${users.patientProfile.id}/assistance-requests`,
    )
    .send({ request_type: "Shelter", description: "Shelter required" });

  const listResponse = await request(app).get(
    "/api/patient/assistance-requests",
  );
  const detailResponse = await request(app).get(
    "/api/patient/assistance-requests/1",
  );

  assert.equal(createResponse.status, 401);
  assert.equal(listResponse.status, 401);
  assert.equal(detailResponse.status, 401);
});

test("Patient Assistance Requests use deterministic newest-first ordering", async () => {
  const older = await insertAssistanceRequest({
    description: "Older request",
    submitted_at: "2026-09-25 09:00:00",
  });
  const newerFirst = await insertAssistanceRequest({
    description: "Newer first request",
    submitted_at: "2026-09-26 09:00:00",
  });
  const newerSecond = await insertAssistanceRequest({
    description: "Newer second request",
    submitted_at: "2026-09-26 09:00:00",
  });

  const response = await request(app)
    .get("/api/patient/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.assistance_requests.map((item) => item.id),
    [newerSecond.id, newerFirst.id, older.id],
  );
});

test("Admin can list all Assistance Requests in deterministic newest-first order", async () => {
  const older = await insertAssistanceRequest({
    description: "Older admin request",
    submitted_at: "2026-09-25 09:00:00",
  });
  const newerFirst = await insertAssistanceRequest({
    description: "Newer first admin request",
    submitted_at: "2026-09-26 09:00:00",
  });
  const newerSecond = await insertAssistanceRequest({
    description: "Newer second admin request",
    submitted_at: "2026-09-26 09:00:00",
  });

  const response = await request(app)
    .get("/api/admin/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.assistance_requests.map((item) => item.id),
    [newerSecond.id, newerFirst.id, older.id],
  );
});

test("Admin can view an Assistance Request and missing detail returns 404", async () => {
  const assistanceRequest = await insertAssistanceRequest();

  const found = await request(app)
    .get(`/api/admin/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);
  const missing = await request(app)
    .get("/api/admin/assistance-requests/999999999")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(found.status, 200);
  assert.equal(found.body.data.assistance_request.id, assistanceRequest.id);
  assert.equal(missing.status, 404);
});

test("Admin can assign a pending Assistance Request to an active NGO", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest();

  const response = await request(app)
    .patch(`/api/admin/assistance-requests/${assistanceRequest.id}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ ngo_id: ngo.id });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.assistance_request.ngo_id, ngo.id);
  assert.equal(response.body.data.assistance_request.status, "PENDING");

  const stored = await db("assistance_requests")
    .where({ id: assistanceRequest.id })
    .first();
  assert.equal(stored.ngo_id, ngo.id);
  assert.equal(stored.status, "PENDING");
});

test("Assistance Request assignment rejects missing, invalid, unsafe, and out-of-range NGO IDs", async () => {
  const assistanceRequest = await insertAssistanceRequest();
  const path = `/api/admin/assistance-requests/${assistanceRequest.id}/assign`;
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const responses = await Promise.all([
    request(app).patch(path).set("Authorization", authorization).send({}),
    request(app).patch(path).set("Authorization", authorization).send({ ngo_id: 0 }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ ngo_id: Number.MAX_SAFE_INTEGER + 1 }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ ngo_id: "18446744073709551616" }),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 400);
  }
});

test("Assistance Request assignment rejects unknown fields and invalid request IDs", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest();

  const unknown = await request(app)
    .patch(`/api/admin/assistance-requests/${assistanceRequest.id}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ ngo_id: ngo.id, status: "UNDER_REVIEW" });
  const invalidId = await request(app)
    .patch("/api/admin/assistance-requests/not-an-id/assign")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ ngo_id: ngo.id });

  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.errors.status, "status is not allowed");
  assert.equal(invalidId.status, 400);
});

test("Admin cannot assign to a missing, inactive, or wrong-role NGO", async () => {
  const inactive = await createAssistanceNgo({
    email: "inactive.assistance.ngo@test.local",
    registrationNumber: "ASSIST-NGO-INACTIVE",
    accountStatus: "INACTIVE",
  });
  const wrongRole = await createAssistanceNgo({
    email: "wrong.role.assistance.ngo@test.local",
    registrationNumber: "ASSIST-NGO-WRONG-ROLE",
    role: "PATIENT",
  });

  for (const [ngoId, expectedStatus] of [
    ["999999999", 404],
    [inactive.profile.id, 400],
    [wrongRole.profile.id, 400],
  ]) {
    const assistanceRequest = await insertAssistanceRequest();
    const response = await request(app)
      .patch(`/api/admin/assistance-requests/${assistanceRequest.id}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ ngo_id: ngoId });

    assert.equal(response.status, expectedStatus);
  }
});

test("Admin cannot assign a non-pending or already assigned Assistance Request", async () => {
  const ngo = await getPrimaryNgoProfile();
  const nonPending = await insertAssistanceRequest({ status: "UNDER_REVIEW" });
  const alreadyAssigned = await insertAssistanceRequest({ ngo_id: ngo.id });

  for (const assistanceRequest of [nonPending, alreadyAssigned]) {
    const response = await request(app)
      .patch(`/api/admin/assistance-requests/${assistanceRequest.id}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ ngo_id: ngo.id });

    assert.equal(response.status, 409);
  }
});

test("Concurrent Assistance Request assignments allow only one NGO", async () => {
  const firstNgo = await getPrimaryNgoProfile();
  const secondNgo = await createAssistanceNgo({
    email: "concurrent.assistance.ngo@test.local",
    registrationNumber: "ASSIST-NGO-CONCURRENT",
  });
  const assistanceRequest = await insertAssistanceRequest();
  const path = `/api/admin/assistance-requests/${assistanceRequest.id}/assign`;
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ ngo_id: firstNgo.id }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ ngo_id: secondNgo.profile.id }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );
  const stored = await db("assistance_requests")
    .where({ id: assistanceRequest.id })
    .first();
  assert.ok([firstNgo.id, secondNgo.profile.id].includes(Number(stored.ngo_id)));
});

test("Admin Assistance Request routes enforce authentication and ADMIN role", async () => {
  const unauthenticated = await request(app).get(
    "/api/admin/assistance-requests",
  );
  const wrongRole = await request(app)
    .get("/api/admin/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(unauthenticated.status, 401);
  assert.equal(wrongRole.status, 403);
});

test("NGO can list only assigned Assistance Requests in newest-first order", async () => {
  const ngo = await getPrimaryNgoProfile();
  const otherNgo = await createAssistanceNgo({
    email: "other.list.assistance.ngo@test.local",
    registrationNumber: "ASSIST-NGO-OTHER-LIST",
  });
  const older = await insertAssistanceRequest({
    ngo_id: ngo.id,
    submitted_at: "2026-09-25 09:00:00",
  });
  const newerFirst = await insertAssistanceRequest({
    ngo_id: ngo.id,
    submitted_at: "2026-09-26 09:00:00",
  });
  const newerSecond = await insertAssistanceRequest({
    ngo_id: ngo.id,
    submitted_at: "2026-09-26 09:00:00",
  });
  await insertAssistanceRequest({ ngo_id: otherNgo.profile.id });

  const response = await request(app)
    .get("/api/ngo/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.assistance_requests.map((item) => item.id),
    [newerSecond.id, newerFirst.id, older.id],
  );
});

test("NGO can view its assigned Assistance Request", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id });

  const response = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.assistance_request.id, assistanceRequest.id);
});

test("NGO detail distinguishes another NGO's request from a missing request", async () => {
  const otherNgo = await createAssistanceNgo({
    email: "other.detail.assistance.ngo@test.local",
    registrationNumber: "ASSIST-NGO-OTHER-DETAIL",
  });
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: otherNgo.profile.id,
  });
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const forbidden = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", authorization);
  const missing = await request(app)
    .get("/api/ngo/assistance-requests/999999999")
    .set("Authorization", authorization);

  assert.equal(forbidden.status, 403);
  assert.equal(missing.status, 404);
});

test("NGO Assistance Request routes validate IDs and enforce access", async () => {
  const invalid = await request(app)
    .get("/api/ngo/assistance-requests/not-an-id")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);
  const outOfRange = await request(app)
    .get("/api/ngo/assistance-requests/18446744073709551616")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);
  const unauthenticated = await request(app).get(
    "/api/ngo/assistance-requests",
  );
  const wrongRole = await request(app)
    .get("/api/ngo/assistance-requests")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(invalid.status, 400);
  assert.equal(outOfRange.status, 400);
  assert.equal(unauthenticated.status, 401);
  assert.equal(wrongRole.status, 403);
});

test("NGO can move an assigned request from PENDING to UNDER_REVIEW", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id });

  const response = await request(app)
    .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({ status: "UNDER_REVIEW" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.assistance_request.status, "UNDER_REVIEW");
  assert.equal(response.body.data.assistance_request.reviewed_at, null);
});

test("NGO can approve or reject an under-review request and reviewed_at is set", async () => {
  const ngo = await getPrimaryNgoProfile();

  for (const status of ["APPROVED", "REJECTED"]) {
    const assistanceRequest = await insertAssistanceRequest({
      ngo_id: ngo.id,
      status: "UNDER_REVIEW",
    });
    const response = await request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
      .send({ status });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.assistance_request.status, status);
    assert.ok(response.body.data.assistance_request.reviewed_at);
  }
});

test("NGO cannot complete an approved request without a Resource Allocation", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });

  const response = await request(app)
    .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({ status: "COMPLETED" });

  assert.equal(response.status, 409);
  assert.equal(
    response.body.message,
    "At least one resource allocation is required before completing the assistance request.",
  );
});

test("NGO can complete an approved request with a Resource Allocation", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  await db("resource_allocations").insert({
    assistance_request_id: assistanceRequest.id,
    resource_name: "Medical kit",
    quantity: 1,
  });

  const response = await request(app)
    .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({ status: "COMPLETED" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.assistance_request.status, "COMPLETED");
});

test("NGO status update rejects invalid transitions and same-status updates", async () => {
  const ngo = await getPrimaryNgoProfile();

  for (const [currentStatus, nextStatus] of [
    ["PENDING", "APPROVED"],
    ["PENDING", "PENDING"],
    ["REJECTED", "COMPLETED"],
    ["COMPLETED", "UNDER_REVIEW"],
  ]) {
    const assistanceRequest = await insertAssistanceRequest({
      ngo_id: ngo.id,
      status: currentStatus,
    });
    const response = await request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
      .send({ status: nextStatus });

    assert.equal(response.status, 409);
  }
});

test("NGO status update accepts exactly one supported status field", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/status`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const missing = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({});
  const invalid = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "ASSIGNED" });
  const unknown = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "UNDER_REVIEW", ngo_id: ngo.id });

  assert.equal(missing.status, 400);
  assert.equal(invalid.status, 400);
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.errors.ngo_id, "ngo_id is not allowed");
});

test("NGO cannot update another NGO's Assistance Request", async () => {
  const otherNgo = await createAssistanceNgo({
    email: "other.status.assistance.ngo@test.local",
    registrationNumber: "ASSIST-NGO-OTHER-STATUS",
  });
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: otherNgo.profile.id,
  });

  const response = await request(app)
    .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({ status: "UNDER_REVIEW" });

  assert.equal(response.status, 403);
});

test("Concurrent NGO status transitions allow only one transition", async () => {
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
  const stored = await db("assistance_requests")
    .where({ id: assistanceRequest.id })
    .first();
  assert.ok(["APPROVED", "REJECTED"].includes(stored.status));
  assert.ok(stored.reviewed_at);

  const successfulResponse = responses.find((response) => response.status === 200);
  assert.equal(
    successfulResponse.body.data.assistance_request.status,
    stored.status,
  );

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
      (notification) =>
        notification.type === "ASSISTANCE_REQUEST" &&
        notification.title === "Assistance Request status updated" &&
        notification.message ===
          `Assistance Request #${assistanceRequest.id} is now ${stored.status}.`,
    ),
  );
});

test("assigned NGO creates and persists a Resource Allocation for an approved request", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });

  const response = await request(app)
    .post(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({
      resource_name: "Medical Supplies",
      quantity: 3,
      delivery_date: "2026-09-25",
      notes: "Delivered to the patient.",
    });

  assert.equal(response.status, 201);
  const allocation = response.body.data.resource_allocation;
  assert.equal(allocation.assistance_request_id, assistanceRequest.id);
  assert.equal(allocation.resource_name, "Medical Supplies");
  assert.equal(allocation.quantity, 3);
  assert.equal(String(allocation.delivery_date).slice(0, 10), "2026-09-25");
  assert.equal(allocation.notes, "Delivered to the patient.");
  assert.ok(await db("resource_allocations").where({ id: allocation.id }).first());
});

test("Resource Allocation creation requires an approved request", async () => {
  const ngo = await getPrimaryNgoProfile();

  for (const status of ["PENDING", "UNDER_REVIEW", "REJECTED", "COMPLETED"]) {
    const assistanceRequest = await insertAssistanceRequest({
      ngo_id: ngo.id,
      status,
    });
    const response = await request(app)
      .post(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources`)
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
      .send({ resource_name: "Food parcel", quantity: 1 });

    assert.equal(response.status, 409);
  }
});

test("Resource Allocation creation enforces NGO ownership and request existence", async () => {
  const otherNgo = await createAssistanceNgo({
    email: "resource.other.ngo@test.local",
    registrationNumber: "RESOURCE-OTHER-NGO",
  });
  const otherRequest = await insertAssistanceRequest({
    ngo_id: otherNgo.profile.id,
    status: "APPROVED",
  });
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const forbidden = await request(app)
    .post(`/api/ngo/assistance-requests/${otherRequest.id}/resources`)
    .set("Authorization", authorization)
    .send({ resource_name: "Food", quantity: 1 });
  const missing = await request(app)
    .post("/api/ngo/assistance-requests/999999999/resources")
    .set("Authorization", authorization)
    .send({ resource_name: "Food", quantity: 1 });

  assert.equal(forbidden.status, 403);
  assert.equal(missing.status, 404);
});

test("Resource Allocation creation validates required names and quantities", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/resources`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;
  const bodies = [
    { quantity: 1 },
    { resource_name: "  ", quantity: 1 },
    { resource_name: "x".repeat(151), quantity: 1 },
    { resource_name: "Food" },
    { resource_name: "Food", quantity: 0 },
    { resource_name: "Food", quantity: -1 },
    { resource_name: "Food", quantity: 1.5 },
    { resource_name: "Food", quantity: 4294967296 },
  ];

  for (const body of bodies) {
    const response = await request(app)
      .post(path)
      .set("Authorization", authorization)
      .send(body);
    assert.equal(response.status, 400);
  }
});

test("Resource Allocation creation validates dates and rejects protected fields", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/resources`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const invalidDate = await request(app)
    .post(path)
    .set("Authorization", authorization)
    .send({ resource_name: "Food", quantity: 1, delivery_date: "2026-02-30" });
  const protectedFields = await request(app)
    .post(path)
    .set("Authorization", authorization)
    .send({
      resource_name: "Food",
      quantity: 1,
      id: 5,
      assistance_request_id: assistanceRequest.id,
      created_at: "2026-09-25",
      updated_at: "2026-09-25",
    });

  assert.equal(invalidDate.status, 400);
  assert.equal(protectedFields.status, 400);
  for (const field of ["id", "assistance_request_id", "created_at", "updated_at"]) {
    assert.equal(protectedFields.body.errors[field], `${field} is not allowed`);
  }
});

test("NGO lists only allocations for its requested Assistance Request in deterministic order", async () => {
  const ngo = await getPrimaryNgoProfile();
  const firstRequest = await insertAssistanceRequest({ ngo_id: ngo.id });
  const secondRequest = await insertAssistanceRequest({ ngo_id: ngo.id });
  const first = await insertResourceAllocation(firstRequest.id, {
    resource_name: "First",
    created_at: "2026-09-25 10:00:00",
  });
  const second = await insertResourceAllocation(firstRequest.id, {
    resource_name: "Second",
    created_at: "2026-09-25 10:00:00",
  });
  await insertResourceAllocation(secondRequest.id);

  const response = await request(app)
    .get(`/api/ngo/assistance-requests/${firstRequest.id}/resources`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.resource_allocations.map((item) => item.id),
    [first.id, second.id],
  );
});

test("NGO Resource Allocation list rejects another NGO", async () => {
  const otherNgo = await createAssistanceNgo({
    email: "resource.list.other@test.local",
    registrationNumber: "RESOURCE-LIST-OTHER",
  });
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: otherNgo.profile.id,
  });

  const response = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 403);
});

test("NGO can partially update every Resource Allocation field and clear nullable fields", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const allocation = await insertResourceAllocation(assistanceRequest.id, {
    delivery_date: "2026-09-25",
    notes: "Original",
  });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const nameResponse = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ resource_name: "Updated supplies" });
  const valuesResponse = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ quantity: 5, delivery_date: null, notes: null });

  assert.equal(nameResponse.status, 200);
  assert.equal(nameResponse.body.data.resource_allocation.resource_name, "Updated supplies");
  assert.equal(valuesResponse.status, 200);
  assert.equal(valuesResponse.body.data.resource_allocation.quantity, 5);
  assert.equal(valuesResponse.body.data.resource_allocation.delivery_date, null);
  assert.equal(valuesResponse.body.data.resource_allocation.notes, null);
});

test("Resource Allocation update rejects invalid bodies", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const allocation = await insertResourceAllocation(assistanceRequest.id);
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  for (const body of [{}, { quantity: 0 }, { resource_name: null }, { status: "COMPLETED" }]) {
    const response = await request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send(body);
    assert.equal(response.status, 400);
  }
});

test("Resource Allocation update enforces relationship existence completion and NGO ownership", async () => {
  const ngo = await getPrimaryNgoProfile();
  const requestOne = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const requestTwo = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const allocation = await insertResourceAllocation(requestTwo.id);
  const completed = await insertAssistanceRequest({ ngo_id: ngo.id, status: "COMPLETED" });
  const completedAllocation = await insertResourceAllocation(completed.id);
  const otherNgo = await createAssistanceNgo({
    email: "resource.update.other@test.local",
    registrationNumber: "RESOURCE-UPDATE-OTHER",
  });
  const otherRequest = await insertAssistanceRequest({ ngo_id: otherNgo.profile.id, status: "APPROVED" });
  const otherAllocation = await insertResourceAllocation(otherRequest.id);
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const crossRequest = await request(app)
    .patch(`/api/ngo/assistance-requests/${requestOne.id}/resources/${allocation.id}`)
    .set("Authorization", authorization)
    .send({ quantity: 3 });
  const missing = await request(app)
    .patch(`/api/ngo/assistance-requests/${requestOne.id}/resources/999999999`)
    .set("Authorization", authorization)
    .send({ quantity: 3 });
  const afterCompletion = await request(app)
    .patch(`/api/ngo/assistance-requests/${completed.id}/resources/${completedAllocation.id}`)
    .set("Authorization", authorization)
    .send({ quantity: 3 });
  const forbidden = await request(app)
    .patch(`/api/ngo/assistance-requests/${otherRequest.id}/resources/${otherAllocation.id}`)
    .set("Authorization", authorization)
    .send({ quantity: 3 });

  assert.equal(crossRequest.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(afterCompletion.status, 409);
  assert.equal(forbidden.status, 403);
});

test("NGO can delete a Resource Allocation before completion", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const allocation = await insertResourceAllocation(assistanceRequest.id);

  const response = await request(app)
    .delete(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.resource_allocation.id, allocation.id);
  assert.equal(await db("resource_allocations").where({ id: allocation.id }).first(), undefined);
});

test("Resource Allocation deletion enforces relationship existence completion and NGO ownership", async () => {
  const ngo = await getPrimaryNgoProfile();
  const requestOne = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const requestTwo = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const allocation = await insertResourceAllocation(requestTwo.id);
  const completed = await insertAssistanceRequest({ ngo_id: ngo.id, status: "COMPLETED" });
  const completedAllocation = await insertResourceAllocation(completed.id);
  const otherNgo = await createAssistanceNgo({
    email: "resource.delete.other@test.local",
    registrationNumber: "RESOURCE-DELETE-OTHER",
  });
  const otherRequest = await insertAssistanceRequest({ ngo_id: otherNgo.profile.id, status: "APPROVED" });
  const otherAllocation = await insertResourceAllocation(otherRequest.id);
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const paths = [
    [`/api/ngo/assistance-requests/${requestOne.id}/resources/${allocation.id}`, 404],
    [`/api/ngo/assistance-requests/${requestOne.id}/resources/999999999`, 404],
    [`/api/ngo/assistance-requests/${completed.id}/resources/${completedAllocation.id}`, 409],
    [`/api/ngo/assistance-requests/${otherRequest.id}/resources/${otherAllocation.id}`, 403],
  ];

  for (const [path, expectedStatus] of paths) {
    const response = await request(app)
      .delete(path)
      .set("Authorization", authorization);
    assert.equal(response.status, expectedStatus);
  }
});

test("Patient reads resources only for own Assistance Request", async () => {
  const ownRequest = await insertAssistanceRequest();
  const ownAllocation = await insertResourceAllocation(ownRequest.id);
  const { patientProfile } = await createSecondPatientForAssistanceRequests();
  const otherRequest = await insertAssistanceRequest({ patient_id: patientProfile.id });
  await insertResourceAllocation(otherRequest.id);
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const own = await request(app)
    .get(`/api/patient/assistance-requests/${ownRequest.id}/resources`)
    .set("Authorization", authorization);
  const other = await request(app)
    .get(`/api/patient/assistance-requests/${otherRequest.id}/resources`)
    .set("Authorization", authorization);
  const missing = await request(app)
    .get("/api/patient/assistance-requests/999999999/resources")
    .set("Authorization", authorization);

  assert.equal(own.status, 200);
  assert.deepEqual(own.body.data.resource_allocations.map((item) => item.id), [ownAllocation.id]);
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
});

test("Doctor reads resources only for Assistance Requests they created", async () => {
  const ownRequest = await insertAssistanceRequest();
  const allocation = await insertResourceAllocation(ownRequest.id);
  const otherDoctorUser = await createUser({
    fullName: "Other Resource Doctor",
    email: "other.resource.doctor@test.local",
    role: "DOCTOR",
  });
  const [otherDoctorId] = await db("doctors").insert({
    user_id: otherDoctorUser.id,
    specialization: "General Medicine",
    license_number: "RESOURCE-DOCTOR-OTHER",
  });
  const otherRequest = await insertAssistanceRequest({ doctor_id: otherDoctorId });
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const own = await request(app)
    .get(`/api/doctor/assistance-requests/${ownRequest.id}/resources`)
    .set("Authorization", authorization);
  const other = await request(app)
    .get(`/api/doctor/assistance-requests/${otherRequest.id}/resources`)
    .set("Authorization", authorization);
  const missing = await request(app)
    .get("/api/doctor/assistance-requests/999999999/resources")
    .set("Authorization", authorization);

  assert.equal(own.status, 200);
  assert.deepEqual(own.body.data.resource_allocations.map((item) => item.id), [allocation.id]);
  assert.equal(other.status, 403);
  assert.equal(missing.status, 404);
});

test("Admin reads Resource Allocations for any request and missing request returns 404", async () => {
  const assistanceRequest = await insertAssistanceRequest();
  const allocation = await insertResourceAllocation(assistanceRequest.id);
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const found = await request(app)
    .get(`/api/admin/assistance-requests/${assistanceRequest.id}/resources`)
    .set("Authorization", authorization);
  const missing = await request(app)
    .get("/api/admin/assistance-requests/999999999/resources")
    .set("Authorization", authorization);

  assert.equal(found.status, 200);
  assert.deepEqual(found.body.data.resource_allocations.map((item) => item.id), [allocation.id]);
  assert.equal(missing.status, 404);
});

test("Resource Allocation routes enforce authentication role and identifier validation", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const allocation = await insertResourceAllocation(assistanceRequest.id);

  const unauthenticated = await request(app).get(
    `/api/ngo/assistance-requests/${assistanceRequest.id}/resources`,
  );
  const wrongRole = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const invalidRequest = await request(app)
    .get("/api/ngo/assistance-requests/not-an-id/resources")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);
  const invalidResource = await request(app)
    .delete(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources/not-an-id`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);
  const outOfRange = await request(app)
    .delete(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources/18446744073709551616`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(unauthenticated.status, 401);
  assert.equal(wrongRole.status, 403);
  assert.equal(invalidRequest.status, 400);
  assert.equal(invalidResource.status, 400);
  assert.equal(outOfRange.status, 400);
  assert.ok(allocation);
});

test("NGO can read Resource Allocations after Assistance Request completion", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "COMPLETED",
  });
  const allocation = await insertResourceAllocation(assistanceRequest.id, {
    resource_name: "Completed request supplies",
    quantity: 4,
    delivery_date: "2026-09-27",
    notes: "Delivered before completion",
  });

  const response = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.resource_allocations.length, 1);
  assert.deepEqual(response.body.data.resource_allocations[0], {
    id: allocation.id,
    assistance_request_id: assistanceRequest.id,
    resource_name: "Completed request supplies",
    quantity: 4,
    delivery_date: "2026-09-27",
    notes: "Delivered before completion",
    created_at: response.body.data.resource_allocations[0].created_at,
    updated_at: response.body.data.resource_allocations[0].updated_at,
  });
});

test("deleting the last allocation racing with completion preserves the completion guard", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const allocation = await insertResourceAllocation(assistanceRequest.id);
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const [deleteResponse, completeResponse] = await Promise.all([
    request(app)
      .delete(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`)
      .set("Authorization", authorization),
    request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", authorization)
      .send({ status: "COMPLETED" }),
  ]);

  assert.deepEqual([deleteResponse.status, completeResponse.status].sort((a, b) => a - b), [200, 409]);
  const storedRequest = await db("assistance_requests").where({ id: assistanceRequest.id }).first();
  const count = Number((await db("resource_allocations").where({ assistance_request_id: assistanceRequest.id }).count({ count: "*" }).first()).count);
  assert.ok(storedRequest.status !== "COMPLETED" || count > 0);
});

test("Resource Allocation update racing with completion cannot mutate after completion", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const allocation = await insertResourceAllocation(assistanceRequest.id);
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const [updateResponse, completeResponse] = await Promise.all([
    request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`)
      .set("Authorization", authorization)
      .send({ quantity: 7 }),
    request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", authorization)
      .send({ status: "COMPLETED" }),
  ]);

  assert.equal(completeResponse.status, 200);
  assert.ok([200, 409].includes(updateResponse.status));
  const storedRequest = await db("assistance_requests").where({ id: assistanceRequest.id }).first();
  const storedAllocation = await db("resource_allocations")
    .where({ id: allocation.id })
    .first();
  assert.equal(storedRequest.status, "COMPLETED");

  if (updateResponse.status === 200) {
    assert.equal(storedAllocation.quantity, 7);
  } else {
    assert.equal(updateResponse.status, 409);
    assert.equal(storedAllocation.quantity, 2);
  }
});

test("concurrent partial Resource Allocation updates preserve unrelated fields", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const allocation = await insertResourceAllocation(assistanceRequest.id, {
    quantity: 2,
    notes: "Original notes",
  });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const [quantityResponse, notesResponse] = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ quantity: 9 }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ notes: "Concurrent notes update" }),
  ]);

  assert.equal(quantityResponse.status, 200);
  assert.equal(notesResponse.status, 200);

  const storedAllocation = await db("resource_allocations")
    .where({ id: allocation.id })
    .first();
  assert.equal(storedAllocation.quantity, 9);
  assert.equal(storedAllocation.notes, "Concurrent notes update");
});

test("concurrent Resource Allocation update and delete never recreate a deleted row", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "APPROVED",
  });
  const allocation = await insertResourceAllocation(assistanceRequest.id);
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/resources/${allocation.id}`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const [updateResponse, deleteResponse] = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ quantity: 11 }),
    request(app).delete(path).set("Authorization", authorization),
  ]);

  assert.ok(
    (updateResponse.status === 200 && deleteResponse.status === 200) ||
      (updateResponse.status === 404 && deleteResponse.status === 200),
  );

  const storedAllocation = await db("resource_allocations")
    .where({ id: allocation.id })
    .first();
  assert.equal(storedAllocation, undefined);
});

test("Resource Allocation creation racing with completion preserves a consistent final state", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id, status: "APPROVED" });
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const [createResponse, completeResponse] = await Promise.all([
    request(app)
      .post(`/api/ngo/assistance-requests/${assistanceRequest.id}/resources`)
      .set("Authorization", authorization)
      .send({ resource_name: "Concurrent support", quantity: 1 }),
    request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", authorization)
      .send({ status: "COMPLETED" }),
  ]);

  assert.equal(createResponse.status, 201);
  assert.ok([200, 409].includes(completeResponse.status));
  const storedRequest = await db("assistance_requests").where({ id: assistanceRequest.id }).first();
  const count = Number((await db("resource_allocations").where({ assistance_request_id: assistanceRequest.id }).count({ count: "*" }).first()).count);
  assert.ok(storedRequest.status !== "COMPLETED" || count > 0);
});
