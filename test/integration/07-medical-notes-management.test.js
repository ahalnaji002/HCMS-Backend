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
  insertMedicalNote,
  createSecondDoctor,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Medical Notes Management
registerIntegrationHooks();

test("POST medical note rejects unauthenticated requests", async () => {
  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .send({ note: "Patient condition is improving." });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("patient cannot use doctor medical notes endpoints", async () => {
  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("doctor cannot create a medical note without an active assignment", async () => {
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ note: "Patient condition is improving." });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("inactive assignment does not authorize medical notes access", async () => {
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
    ended_at: db.fn.now(),
  });

  await insertMedicalRecord();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("assigned doctor can create a medical note", async () => {
  await insertActiveAssignment();
  const medicalRecord = await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      note: "  Patient condition is improving.  ",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Medical Note created successfully");

  const medicalNote = response.body.data.medical_note;

  assert.equal(Number(medicalNote.medical_record_id), Number(medicalRecord.id));
  assert.equal(Number(medicalNote.doctor_id), Number(users.doctorProfile.id));
  assert.equal(medicalNote.note, "Patient condition is improving.");

  const stored = await db("medical_notes")
    .where({ id: medicalNote.id })
    .first();

  assert.ok(stored);
  assert.equal(stored.note, "Patient condition is improving.");
});

test("medical note creation rejects missing note", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.note, "note is required");
});

test("medical note creation rejects empty note", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ note: "   " });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.note, "note must not be empty");
});

test("medical note creation rejects non-string note", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ note: 123 });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.note, "note must be a string");
});

test("medical note creation rejects protected and unknown fields", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      note: "Valid note",
      doctor_id: 999,
      medical_record_id: 999,
      id: 999,
      created_at: "2026-09-21",
      unexpected_field: "not allowed",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.doctor_id);
  assert.ok(response.body.errors.medical_record_id);
  assert.ok(response.body.errors.id);
  assert.ok(response.body.errors.created_at);
  assert.ok(response.body.errors.unexpected_field);

  const notes = await db("medical_notes");
  assert.equal(notes.length, 0);
});

test("medical note validation enforces TEXT UTF-8 byte limit", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      note: "😀".repeat(16384),
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.note, "note must not exceed 65535 bytes");
});

test("medical notes access safely rejects an invalid patient ID", async () => {
  const response = await request(app)
    .get("/api/doctor/patients/not-an-id/medical-notes")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(
    response.body.errors.patientId,
    "patientId must be a positive integer",
  );
});

test("medical notes access returns 404 when patient does not exist", async () => {
  const response = await request(app)
    .get("/api/doctor/patients/999999999/medical-notes")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Patient not found");
});

test("assigned doctor cannot create a note without a medical record", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ note: "Patient condition is improving." });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Medical Record not found");

  const notes = await db("medical_notes");
  assert.equal(notes.length, 0);
});

test("assigned doctor gets 404 when listing notes without a medical record", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Medical Record not found");
});

test("assigned doctor gets an empty medical notes list when they have no notes", async () => {
  await insertActiveAssignment();
  await insertMedicalRecord();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Medical Notes retrieved successfully");
  assert.deepEqual(response.body.data.medical_notes, []);
});

test("doctor can retrieve only medical notes they personally created", async () => {
  await insertActiveAssignment();
  const medicalRecord = await insertMedicalRecord();

  const ownNote = await insertMedicalNote({
    medical_record_id: medicalRecord.id,
    doctor_id: users.doctorProfile.id,
    note: "First doctor's private medical note",
  });

  const secondDoctor = await createSecondDoctor();

  await db("doctor_patient_assignments").insert({
    doctor_id: secondDoctor.profile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  const [otherNoteId] = await db("medical_notes").insert({
    medical_record_id: medicalRecord.id,
    doctor_id: secondDoctor.profile.id,
    note: "Second doctor's private medical note",
  });

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/medical-notes`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.medical_notes.length, 1);
  assert.equal(
    Number(response.body.data.medical_notes[0].id),
    Number(ownNote.id),
  );
  assert.equal(
    Number(response.body.data.medical_notes[0].doctor_id),
    Number(users.doctorProfile.id),
  );
  assert.notEqual(
    Number(response.body.data.medical_notes[0].id),
    Number(otherNoteId),
  );
  assert.equal(
    response.body.data.medical_notes[0].note,
    "First doctor's private medical note",
  );
});
