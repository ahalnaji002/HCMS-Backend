const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  users,
  tokenFor,
  insertAssignment,
  createSecondPatient,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Doctor Assigned-Patient Access
registerIntegrationHooks();

test("GET assigned patients rejects unauthenticated requests", async () => {
  const response = await request(app).get("/api/doctor/patients");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    success: false,
    message: "Authentication required",
  });
});

test("GET assigned patients rejects non-doctor users", async () => {
  const response = await request(app)
    .get("/api/doctor/patients")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    success: false,
    message: "Forbidden",
  });
});

test("assigned-patient list returns only active assignments", async () => {
  const inactivePatient = await createSecondPatient();

  await insertAssignment();
  await insertAssignment({
    patient_id: inactivePatient.profile.id,
    status: "INACTIVE",
    ended_at: "2026-09-21 10:00:00",
  });

  const response = await request(app)
    .get("/api/doctor/patients")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Assigned Patients retrieved successfully");
  assert.equal(response.body.data.patients.length, 1);
  assert.equal(response.body.data.patients[0].id, users.patientProfile.id);
});

test("assigned-patient list returns only approved safe patient fields", async () => {
  await insertAssignment();

  const response = await request(app)
    .get("/api/doctor/patients")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body.data.patients[0]).sort(), [
    "account_status",
    "address",
    "date_of_birth",
    "email",
    "full_name",
    "gender",
    "id",
    "phone",
    "role",
  ]);
  assert.equal(response.body.data.patients[0].date_of_birth, "2000-01-15");
  assert.equal(response.body.data.patients[0].password_hash, undefined);
  assert.equal(response.body.data.patients[0].user_id, undefined);
});

test("GET assigned patient detail rejects unauthenticated requests", async () => {
  const response = await request(app).get(
    `/api/doctor/patients/${users.patientProfile.id}`,
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("GET assigned patient detail rejects non-doctor users", async () => {
  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("assigned patient detail safely rejects invalid patient IDs", async () => {
  const token = tokenFor(users.doctor);

  for (const patientId of ["0", "invalid", "18446744073709551616"]) {
    const response = await request(app)
      .get(`/api/doctor/patients/${patientId}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.ok(response.body.errors.patientId);
  }
});

test("assigned patient detail returns 404 when the Patient does not exist", async () => {
  const response = await request(app)
    .get("/api/doctor/patients/999999999")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    message: "Patient not found",
  });
});

test("assigned patient detail rejects access without an assignment", async () => {
  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    success: false,
    message: "Active Doctor-Patient Assignment required",
  });
});

test("inactive assignment does not authorize assigned patient detail", async () => {
  await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-21 10:00:00",
  });

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("assigned doctor can view safe assigned patient detail", async () => {
  await insertAssignment();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Assigned Patient retrieved successfully");
  assert.deepEqual(response.body.data.patient, {
    id: users.patientProfile.id,
    full_name: users.patient.full_name,
    email: users.patient.email,
    phone: users.patient.phone,
    role: "PATIENT",
    account_status: "ACTIVE",
    date_of_birth: "2000-01-15",
    gender: "MALE",
    address: "Gaza",
  });
});
