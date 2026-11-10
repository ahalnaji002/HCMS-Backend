const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertMedicalRecord,
  insertActiveAssignment,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Medical Record Management
registerIntegrationHooks();

test("POST medical record rejects unauthenticated requests", async () => {
  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .send({ blood_type: "O+" });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("patient cannot use doctor medical record endpoints", async () => {
  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("doctor cannot create a medical record without an active assignment", async () => {
  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      blood_type: "O+",
      allergies: "Penicillin",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("assigned doctor can create a patient medical record", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      blood_type: "O+",
      allergies: "Penicillin",
      chronic_diseases: null,
      medical_history: "No significant previous history",
      previous_surgeries: null,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Medical Record created successfully");

  const record = response.body.data.medical_record;

  assert.equal(Number(record.patient_id), users.patientProfile.id);
  assert.equal(record.blood_type, "O+");
  assert.equal(record.allergies, "Penicillin");

  const stored = await db("medical_records")
    .where({ patient_id: users.patientProfile.id })
    .first();

  assert.ok(stored);
  assert.equal(stored.blood_type, "O+");
});

test("duplicate medical record creation returns 409", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ blood_type: "A+" });

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Medical Record already exists for this Patient",
  );
});

test("assigned doctor can retrieve a patient medical record", async () => {
  await insertActiveAssignment();
  const stored = await insertMedicalRecord();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(Number(response.body.data.medical_record.id), stored.id);
});

test("assigned doctor can update a patient medical record", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      allergies: "No known allergies",
      medical_history: "Updated medical history",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.data.medical_record.allergies,
    "No known allergies",
  );
  assert.equal(
    response.body.data.medical_record.medical_history,
    "Updated medical history",
  );
});

test("patient can retrieve only their own medical record", async () => {
  const stored = await insertMedicalRecord();

  const response = await request(app)
    .get("/api/patient/medical-record")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(Number(response.body.data.medical_record.id), stored.id);
  assert.equal(
    Number(response.body.data.medical_record.patient_id),
    users.patientProfile.id,
  );
});

test("doctor medical record access returns 404 when patient does not exist", async () => {
  const response = await request(app)
    .get("/api/doctor/patients/999999999/medical-record")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Patient not found");
});

test("doctor medical record access safely rejects an invalid patient ID", async () => {
  const response = await request(app)
    .get("/api/doctor/patients/not-an-id/medical-record")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(
    response.body.errors.patientId,
    "patientId must be a positive integer",
  );
});

test("assigned doctor gets 404 when medical record does not exist", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Medical Record not found");
});

test("assigned doctor cannot update a missing medical record", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ allergies: "None" });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Medical Record not found");
});

test("inactive assignment does not authorize doctor medical record access", async () => {
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
    ended_at: db.fn.now(),
  });

  await insertMedicalRecord();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("medical record creation rejects protected and unknown fields", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      blood_type: "O+",
      patient_id: "999",
      id: 999,
      created_at: "2026-09-20",
      unexpected_field: "not allowed",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.patient_id);
  assert.ok(response.body.errors.id);
  assert.ok(response.body.errors.created_at);
  assert.ok(response.body.errors.unexpected_field);

  const records = await db("medical_records");
  assert.equal(records.length, 0);
});

test("medical record update rejects an empty body", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(
    response.body.errors.body,
    "At least one medical record field is required",
  );
});

test("medical record update rejects protected fields without changing the record", async () => {
  await insertActiveAssignment();
  const original = await insertMedicalRecord();

  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      patient_id: "999",
      updated_at: "2026-09-20",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.patient_id);
  assert.ok(response.body.errors.updated_at);

  const stored = await db("medical_records").where({ id: original.id }).first();

  assert.equal(Number(stored.patient_id), users.patientProfile.id);
});

test("medical record validation enforces blood type and TEXT database limits", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      blood_type: "TOO-LONG",
      allergies: "a".repeat(65536),
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.blood_type);
  assert.ok(response.body.errors.allergies);
});

test("patient gets 404 when their medical record does not exist", async () => {
  const response = await request(app)
    .get("/api/patient/medical-record")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Medical Record not found");
});

test("doctor cannot use the patient own-medical-record endpoint", async () => {
  const response = await request(app)
    .get("/api/patient/medical-record")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("medical record deletion is not exposed", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .delete(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);

  const stored = await db("medical_records")
    .where({ patient_id: users.patientProfile.id })
    .first();

  assert.ok(stored);
});

test("concurrent medical record creation preserves one record per patient", async () => {
  await insertActiveAssignment();

  const token = tokenFor(users.doctor);
  const url = `/api/doctor/patients/${users.patientProfile.id}/medical-record`;

  const responses = await Promise.all([
    request(app)
      .post(url)
      .set("Authorization", `Bearer ${token}`)
      .send({ blood_type: "O+" }),

    request(app)
      .post(url)
      .set("Authorization", `Bearer ${token}`)
      .send({ blood_type: "A+" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [201, 409],
  );

  const records = await db("medical_records").where({
    patient_id: users.patientProfile.id,
  });

  assert.equal(records.length, 1);
});
