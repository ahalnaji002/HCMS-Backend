const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertAssignment,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Doctor-Patient Assignment Status Updates
registerIntegrationHooks();

test("PATCH assignment status rejects unauthenticated requests", async () => {
  const assignment = await insertAssignment();

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .send({ status: "INACTIVE" });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("PATCH assignment status rejects non-admin users", async () => {
  const assignment = await insertAssignment();

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "INACTIVE" });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("admin deactivates an assignment in place and sets ended_at", async () => {
  const assignment = await insertAssignment();

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "INACTIVE" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.message,
    "Doctor-patient assignment status updated successfully",
  );
  assert.equal(Number(response.body.data.assignment.id), assignment.id);
  assert.equal(response.body.data.assignment.status, "INACTIVE");
  assert.ok(response.body.data.assignment.ended_at);

  const storedAssignments = await db("doctor_patient_assignments").where({
    id: assignment.id,
  });

  assert.equal(storedAssignments.length, 1);
  assert.equal(storedAssignments[0].status, "INACTIVE");
  assert.ok(storedAssignments[0].ended_at);
});

test("admin reactivates a historical assignment and clears ended_at", async () => {
  const assignment = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-19 10:00:00",
  });

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "ACTIVE" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(Number(response.body.data.assignment.id), assignment.id);
  assert.equal(response.body.data.assignment.status, "ACTIVE");
  assert.equal(response.body.data.assignment.ended_at, null);
});

test("reactivation rejects an inactive Doctor and preserves the historical assignment", async () => {
  const assignment = await insertAssignment({ status: "INACTIVE", ended_at: "2026-09-19 10:00:00" });
  await db("users").where({ id: users.doctor.id }).update({ account_status: "INACTIVE" });

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "ACTIVE" });

  assert.equal(response.status, 409);
  assert.equal(response.body.message, "Doctor account is not active");
  const stored = await db("doctor_patient_assignments").where({ id: assignment.id }).first();
  assert.equal(stored.status, "INACTIVE");
  assert.ok(stored.ended_at);
});

test("reactivation rejects an inactive Patient and preserves the historical assignment", async () => {
  const assignment = await insertAssignment({ status: "INACTIVE", ended_at: "2026-09-19 10:00:00" });
  await db("users").where({ id: users.patient.id }).update({ account_status: "INACTIVE" });

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "ACTIVE" });

  assert.equal(response.status, 409);
  assert.equal(response.body.message, "Patient account is not active");
  const stored = await db("doctor_patient_assignments").where({ id: assignment.id }).first();
  assert.equal(stored.status, "INACTIVE");
  assert.ok(stored.ended_at);
});

test("reactivation returns 409 when another active pair assignment exists", async () => {
  const historical = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-18 10:00:00",
  });
  await insertAssignment();

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${historical.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "ACTIVE" });

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "An active assignment already exists for this doctor and patient",
  );

  const stored = await db("doctor_patient_assignments")
    .where({ id: historical.id })
    .first();
  assert.equal(stored.status, "INACTIVE");
  assert.ok(stored.ended_at);
});

test("ACTIVE to ACTIVE is rejected as a conflicting no-op", async () => {
  const assignment = await insertAssignment();

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "ACTIVE" });

  assert.equal(response.status, 409);
  assert.equal(
    response.body.message,
    "Doctor-patient assignment is already ACTIVE",
  );
});

test("INACTIVE to INACTIVE is rejected as a conflicting no-op", async () => {
  const assignment = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-19 10:00:00",
  });

  const response = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "INACTIVE" });

  assert.equal(response.status, 409);
  assert.equal(
    response.body.message,
    "Doctor-patient assignment is already INACTIVE",
  );
});

test("assignment status update returns 404 for a missing assignment", async () => {
  const response = await request(app)
    .patch("/api/admin/doctor-patient-assignments/999999999/status")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "INACTIVE" });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    message: "Doctor-patient assignment not found",
  });
});

test("assignment status update safely rejects an invalid ID", async () => {
  const response = await request(app)
    .patch("/api/admin/doctor-patient-assignments/not-an-id/status")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ status: "INACTIVE" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    success: false,
    message: "Validation failed",
    errors: { id: "id must be a positive integer" },
  });
});

test("assignment status update rejects invalid and missing status", async () => {
  const assignment = await insertAssignment();
  const token = tokenFor(users.admin);

  const [invalidResponse, missingResponse] = await Promise.all([
    request(app)
      .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PENDING" }),
    request(app)
      .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({}),
  ]);

  for (const response of [invalidResponse, missingResponse]) {
    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.equal(
      response.body.errors.status,
      "status must be exactly ACTIVE or INACTIVE",
    );
  }
});

test("assignment status update rejects malformed bodies and protected fields", async () => {
  const assignment = await insertAssignment();
  const token = tokenFor(users.admin);

  const malformedResponse = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send(["INACTIVE"]);

  assert.equal(malformedResponse.status, 400);
  assert.equal(
    malformedResponse.body.errors.body,
    "request body must be a JSON object",
  );

  const protectedResponse = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignment.id}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      status: "INACTIVE",
      doctor_id: "999",
      ended_at: null,
      notes: "Changed",
    });

  assert.equal(protectedResponse.status, 400);
  assert.equal(protectedResponse.body.message, "Validation failed");
  assert.ok(protectedResponse.body.errors.doctor_id);
  assert.ok(protectedResponse.body.errors.ended_at);
  assert.ok(protectedResponse.body.errors.notes);

  const stored = await db("doctor_patient_assignments")
    .where({ id: assignment.id })
    .first();
  assert.equal(stored.status, "ACTIVE");
});

test("concurrent reactivation preserves one active assignment per pair", async () => {
  const first = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-17 10:00:00",
  });
  const second = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-18 10:00:00",
  });
  const token = tokenFor(users.admin);

  const responses = await Promise.all([
    request(app)
      .patch(`/api/admin/doctor-patient-assignments/${first.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACTIVE" }),
    request(app)
      .patch(`/api/admin/doctor-patient-assignments/${second.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACTIVE" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );

  const activeAssignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });
  assert.equal(activeAssignments.length, 1);
});
