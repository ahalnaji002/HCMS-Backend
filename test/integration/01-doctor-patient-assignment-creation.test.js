const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  patientIntakePayload,
  insertAssignment,
  insertDoctorEmergencyAlert,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Doctor-Patient Assignment Creation
registerIntegrationHooks();

test("POST /api/admin/doctor-patient-assignments rejects unauthenticated requests", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("POST /api/admin/doctor-patient-assignments rejects non-admin users", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("admin can create an active doctor-patient assignment", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Primary care follow-up",
      notes: "Sprint 6 assignment test",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.message,
    "Doctor-patient assignment created successfully",
  );

  const assignment = response.body.data.assignment;

  assert.equal(Number(assignment.doctor_id), users.doctorProfile.id);
  assert.equal(Number(assignment.patient_id), users.patientProfile.id);
  assert.equal(assignment.status, "ACTIVE");
  assert.equal(assignment.assignment_reason, "Primary care follow-up");
  assert.equal(assignment.notes, "Sprint 6 assignment test");

  const storedAssignment = await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      status: "ACTIVE",
    })
    .first();

  assert.ok(storedAssignment);
});

test("assignment reason is required while notes remain optional", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Routine follow-up",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.assignment.status, "ACTIVE");
  assert.equal(response.body.data.assignment.assignment_reason, "Routine follow-up");
  assert.equal(response.body.data.assignment.notes, null);

  const missingReason = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    });
  assert.equal(missingReason.status, 400);
  assert.ok(missingReason.body.errors.assignment_reason);
});

test("Patient intake submission, edit, review lock, correction, and assignment flow", async () => {
  await db("patient_intakes").where({ patient_id: users.patientProfile.id }).del();
  const patientAuthorization = `Bearer ${tokenFor(users.patient)}`;
  const adminAuthorization = `Bearer ${tokenFor(users.admin)}`;

  const beforeSubmission = await request(app)
    .get("/api/patient/intake")
    .set("Authorization", patientAuthorization);
  assert.equal(beforeSubmission.status, 200);
  assert.equal(beforeSubmission.body.data.intake, null);

  const submission = await request(app)
    .post("/api/patient/intake")
    .set("Authorization", patientAuthorization)
    .send(patientIntakePayload({ symptom_onset: "x".repeat(255) }));
  assert.equal(submission.status, 201);
  assert.equal(submission.body.data.intake.status, "SUBMITTED");

  const longOnset = await request(app)
    .post("/api/patient/intake")
    .set("Authorization", patientAuthorization)
    .send(patientIntakePayload({ symptom_onset: "x".repeat(256) }));
  assert.equal(longOnset.status, 400);
  assert.ok(longOnset.body.errors.symptom_onset);

  const edit = await request(app)
    .put("/api/patient/intake")
    .set("Authorization", patientAuthorization)
    .send(patientIntakePayload({ current_problem: "Updated headache report" }));
  assert.equal(edit.status, 200);
  assert.equal(edit.body.data.intake.current_problem, "Updated headache report");
  assert.equal(edit.body.data.intake.status, "SUBMITTED");

  const intakeId = edit.body.data.intake.id;
  const review = await request(app)
    .patch(`/api/admin/patient-intakes/${intakeId}/start-review`)
    .set("Authorization", adminAuthorization);
  assert.equal(review.status, 200);
  assert.equal(review.body.data.intake.status, "UNDER_REVIEW");
  assert.equal(
    Number(review.body.data.intake.review_started_by_admin_id),
    users.admin.id,
  );
  assert.ok(review.body.data.intake.review_started_at);

  const lockedEdit = await request(app)
    .put("/api/patient/intake")
    .set("Authorization", patientAuthorization)
    .send(patientIntakePayload());
  assert.equal(lockedEdit.status, 409);

  const correction = await request(app)
    .post("/api/patient/intake-correction-requests")
    .set("Authorization", patientAuthorization)
    .send({ message: "Please add my newly reported symptom." });
  assert.equal(correction.status, 201);
  assert.equal(correction.body.data.request.status, "OPEN");

  for (const invalidResponse of [{}, { admin_response: "" }, { admin_response: "   " }]) {
    const rejectedResolution = await request(app)
      .patch(
        `/api/admin/intake-correction-requests/${correction.body.data.request.id}/resolve`,
      )
      .set("Authorization", adminAuthorization)
      .send(invalidResponse);
    assert.equal(rejectedResolution.status, 400);
    assert.ok(rejectedResolution.body.errors.admin_response);
  }

  const stillOpen = await request(app)
    .get("/api/admin/intake-correction-requests")
    .set("Authorization", adminAuthorization);
  assert.equal(stillOpen.status, 200);
  assert.equal(stillOpen.body.data.requests[0].status, "OPEN");

  const resolve = await request(app)
    .patch(
      `/api/admin/intake-correction-requests/${correction.body.data.request.id}/resolve`,
    )
    .set("Authorization", adminAuthorization)
    .send({ admin_response: "The correction has been recorded for review." });
  assert.equal(resolve.status, 200);
  assert.equal(resolve.body.data.request.status, "RESOLVED");
  assert.equal(
    Number(resolve.body.data.request.resolved_by_admin_id),
    users.admin.id,
  );

  const assignment = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", adminAuthorization)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Follow up the headache concern",
    });
  assert.equal(assignment.status, 201);
  assert.equal(assignment.body.data.assignment.status, "ACTIVE");
  const assignedIntake = await request(app)
    .get("/api/patient/intake")
    .set("Authorization", patientAuthorization);
  assert.equal(assignedIntake.body.data.intake.status, "DOCTOR_ASSIGNED");
});

test("Doctor availability blocks routine assignment while capacity remains advisory", async () => {
  const adminAuthorization = `Bearer ${tokenFor(users.admin)}`;
  await request(app)
    .patch(`/api/admin/doctors/${users.doctorProfile.id}/workload`)
    .set("Authorization", adminAuthorization)
    .send({ availability: "UNAVAILABLE", capacity_limit: 0 });

  const blockedRoutine = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", adminAuthorization)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Unavailable check",
    });
  assert.equal(blockedRoutine.status, 409);
  assert.match(blockedRoutine.body.message, /Unavailable/);

  const alert = await insertDoctorEmergencyAlert({
    patient_id: users.patientProfile.id,
    assigned_doctor_id: null,
    assigned_by_admin_id: null,
    assigned_at: null,
    status: "PENDING_ASSIGNMENT",
  });
  const emergency = await request(app)
    .patch(`/api/admin/emergency-alerts/${alert.id}/assign`)
    .set("Authorization", adminAuthorization)
    .send({ doctor_id: users.doctorProfile.id });
  assert.equal(emergency.status, 200);

  await request(app)
    .patch(`/api/admin/doctors/${users.doctorProfile.id}/workload`)
    .set("Authorization", adminAuthorization)
    .send({ availability: "AVAILABLE" });
  const allowedAtCapacity = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", adminAuthorization)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Capacity warning must not block assignment",
    });
  assert.equal(allowedAtCapacity.status, 201);

  const workload = await request(app)
    .get("/api/admin/active-doctors")
    .set("Authorization", adminAuthorization);
  assert.equal(workload.status, 200);
  const doctor = workload.body.data.doctors.find(
    (item) => Number(item.id) === users.doctorProfile.id,
  );
  assert.equal(Number(doctor.active_assignment_count), 1);
  assert.equal(Number(doctor.open_emergency_alert_count), 1);
  assert.equal(doctor.capacity_warning, true);
});

test("Diagnosis APIs expose records only to the Patient and actively assigned Doctors", async () => {
  await insertAssignment();
  const doctorAuthorization = `Bearer ${tokenFor(users.doctor)}`;
  const patientAuthorization = `Bearer ${tokenFor(users.patient)}`;
  const diagnosis = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/diagnoses`)
    .set("Authorization", doctorAuthorization)
    .send({ diagnosis: "Migraine under evaluation" });
  assert.equal(diagnosis.status, 201);
  assert.equal(Number(diagnosis.body.data.diagnosis.doctor_id), users.doctorProfile.id);

  const patientRead = await request(app)
    .get("/api/patient/diagnoses")
    .set("Authorization", patientAuthorization);
  assert.equal(patientRead.status, 200);
  assert.equal(patientRead.body.data.diagnoses.length, 1);

  const assignedDoctorRead = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/diagnoses`)
    .set("Authorization", doctorAuthorization);
  assert.equal(assignedDoctorRead.status, 200);
  assert.equal(assignedDoctorRead.body.data.diagnoses.length, 1);

  const ngoRead = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/diagnoses`)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);
  assert.equal(ngoRead.status, 403);
});

test("assignment creation rejects invalid doctor and patient ids", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: 0,
      patient_id: "invalid",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.doctor_id);
  assert.ok(response.body.errors.patient_id);
});

test("assignment creation rejects protected or unknown fields", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      status: "INACTIVE",
      ended_at: "2026-09-19 12:00:00",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.status);
  assert.ok(response.body.errors.ended_at);

  const assignments = await db("doctor_patient_assignments");

  assert.equal(assignments.length, 0);
});

test("assignment creation returns 404 when doctor does not exist", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: "999999999",
      patient_id: users.patientProfile.id,
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Doctor not found");
});

test("assignment creation returns 404 when patient does not exist", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: "999999999",
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Patient not found");
});

test("assignment creation rejects an inactive doctor account", async () => {
  await db("users")
    .where({ id: users.doctor.id })
    .update({ account_status: "INACTIVE" });

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Doctor account is not active");

  const assignments = await db("doctor_patient_assignments");

  assert.equal(assignments.length, 0);
});

test("assignment creation rejects an inactive patient account", async () => {
  await db("users")
    .where({ id: users.patient.id })
    .update({ account_status: "INACTIVE" });

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Patient account is not active");

  const assignments = await db("doctor_patient_assignments");

  assert.equal(assignments.length, 0);
});

test("assignment creation rejects a doctor profile with a non-doctor user role", async () => {
  await db("users").where({ id: users.doctor.id }).update({ role: "PATIENT" });

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    success: false,
    message: "Doctor account is not active",
  });

  const assignments = await db("doctor_patient_assignments");

  assert.equal(assignments.length, 0);
});

test("assignment creation rejects a patient profile with a non-patient user role", async () => {
  await db("users").where({ id: users.patient.id }).update({ role: "DOCTOR" });

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    success: false,
    message: "Patient account is not active",
  });

  const assignments = await db("doctor_patient_assignments");

  assert.equal(assignments.length, 0);
});

test("assignment creation rejects a duplicate active assignment", async () => {
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
    assignment_reason: "Existing active assignment",
  });

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Test reason",
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "An active assignment already exists for this doctor and patient",
  );

  const activeAssignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  assert.equal(activeAssignments.length, 1);
});

test("historical inactive assignment does not prevent a new active assignment", async () => {
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
    assignment_reason: "Previous assignment",
    ended_at: db.fn.now(),
  });

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "New assignment",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  const assignments = await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    })
    .orderBy("id", "asc");

  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].status, "INACTIVE");
  assert.equal(assignments[1].status, "ACTIVE");
});

test("concurrent assignment creation results in only one active assignment", async () => {
  const payload = {
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    assignment_reason: "Concurrent assignment test",
  };

  const token = tokenFor(users.admin);

  const [firstResponse, secondResponse] = await Promise.all([
    request(app)
      .post("/api/admin/doctor-patient-assignments")
      .set("Authorization", `Bearer ${token}`)
      .send(payload),

    request(app)
      .post("/api/admin/doctor-patient-assignments")
      .set("Authorization", `Bearer ${token}`)
      .send(payload),
  ]);

  const statuses = [firstResponse.status, secondResponse.status].sort(
    (a, b) => a - b,
  );

  assert.deepEqual(statuses, [201, 409]);

  const activeAssignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  assert.equal(activeAssignments.length, 1);
});

test("assignment creation rejects notes exceeding the database TEXT limit", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      notes: "a".repeat(65536),
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.notes, "notes must not exceed 65535 bytes");

  const assignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
  });

  assert.equal(assignments.length, 0);
});

test("assignment notes limit is enforced by UTF-8 byte length", async () => {
  const notes = "أ".repeat(32768);

  assert.ok(Buffer.byteLength(notes, "utf8") > 65535);

  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      notes,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.notes, "notes must not exceed 65535 bytes");

  const assignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
  });

  assert.equal(assignments.length, 0);
});
