const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  patientIntakePayload,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");
const loginService = require("../../src/services/loginService");
const { createRateLimiter } = require("../../src/middleware/rateLimiters");

// Pre-release C3: password change (BE-03), activity log events for sign-ins
// and clinical/coordination changes (BE-04), login timing (BE-13).
registerIntegrationHooks();

const KNOWN_PASSWORD = "Known@2026";

async function setPassword(user, password) {
  await db("users")
    .where({ id: user.id })
    .update({ password_hash: bcrypt.hashSync(password, 4) });
}

function bearer(user) {
  return `Bearer ${tokenFor(user)}`;
}

async function logs(action) {
  return db("activity_logs").where({ action }).orderBy("id", "asc");
}

function changePassword(user, body) {
  return request(app)
    .patch("/api/profile/password")
    .set("Authorization", bearer(user))
    .send(body);
}

test("every role can change its password and sign in with the new one", async () => {
  for (const user of [users.patient, users.doctor, users.ngo, users.admin]) {
    await setPassword(user, KNOWN_PASSWORD);

    const response = await changePassword(user, {
      current_password: KNOWN_PASSWORD,
      new_password: "Changed@2027",
      new_password_confirmation: "Changed@2027",
    });

    assert.equal(response.status, 200, user.role);
    assert.deepEqual(response.body, {
      success: true,
      message: "Password changed successfully",
    });

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: KNOWN_PASSWORD });
    assert.equal(oldLogin.status, 401, user.role);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Changed@2027" });
    assert.equal(newLogin.status, 200, user.role);
  }

  const changes = await logs("CHANGE_PASSWORD");
  assert.equal(changes.length, 4);
  for (const entry of changes) {
    assert.equal(entry.entity_type, "USER");
    assert.equal(String(entry.user_id), String(entry.entity_id));
    assert.doesNotMatch(entry.description, /Changed@2027|Known@2026/);
  }
});

test("a wrong current password is a 400 field error and changes nothing", async () => {
  await setPassword(users.patient, KNOWN_PASSWORD);
  const before = (await db("users").where({ id: users.patient.id }).first()).password_hash;

  const response = await changePassword(users.patient, {
    current_password: "Wrong@2026",
    new_password: "Changed@2027",
    new_password_confirmation: "Changed@2027",
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body.errors, {
    current_password: "current_password is incorrect",
  });
  const after = (await db("users").where({ id: users.patient.id }).first()).password_hash;
  assert.equal(after, before);
  assert.equal((await logs("CHANGE_PASSWORD")).length, 0);
});

test("password change validates the body and the password policy", async () => {
  const cases = [
    [{}, ["current_password", "new_password", "new_password_confirmation"]],
    [
      { current_password: "x", new_password: "short1A", new_password_confirmation: "short1A" },
      ["new_password"],
    ],
    [
      { current_password: "x", new_password: "nouppercase1", new_password_confirmation: "nouppercase1" },
      ["new_password"],
    ],
    [
      { current_password: "x", new_password: "Changed@2027", new_password_confirmation: "Other@2027" },
      ["new_password_confirmation"],
    ],
    [
      { current_password: "Same@2026", new_password: "Same@2026", new_password_confirmation: "Same@2026" },
      ["new_password"],
    ],
    [
      { current_password: "x", new_password: "Changed@2027", new_password_confirmation: "Changed@2027", role: "ADMIN" },
      ["role"],
    ],
  ];

  for (const [body, fields] of cases) {
    const response = await changePassword(users.doctor, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(Object.keys(response.body.errors).sort(), [...fields].sort(), JSON.stringify(body));
  }

  const confirmation = await changePassword(users.doctor, {
    current_password: "x",
    new_password: "Changed@2027",
    new_password_confirmation: "Other@2027",
  });
  assert.equal(
    confirmation.body.errors.new_password_confirmation,
    "new_password_confirmation must match new_password",
  );

  const unauthenticated = await request(app)
    .patch("/api/profile/password")
    .send({ current_password: "x", new_password: "Changed@2027", new_password_confirmation: "Changed@2027" });
  assert.equal(unauthenticated.status, 401);
});

test("a limiter with skipSuccessfulRequests (as on password change) counts only failures", async () => {
  const express = require("express");
  const limited = express();
  limited.use(
    createRateLimiter({ windowMs: 60000, limit: 2, skipSuccessfulRequests: true, enabledInTest: true }),
  );
  limited.get("/ok", (req, res) => res.status(200).json({ success: true }));
  limited.get("/fail", (req, res) => res.status(400).json({ success: false }));

  for (let index = 0; index < 5; index += 1) {
    assert.equal((await request(limited).get("/ok")).status, 200);
  }
  assert.equal((await request(limited).get("/fail")).status, 400);
  assert.equal((await request(limited).get("/fail")).status, 400);
  assert.equal((await request(limited).get("/fail")).status, 429);
});

test("sign-ins are logged without storing the email or password", async () => {
  await setPassword(users.patient, KNOWN_PASSWORD);

  await request(app).post("/api/auth/login").send({ email: users.patient.email, password: KNOWN_PASSWORD });
  await request(app).post("/api/auth/login").send({ email: users.patient.email, password: "Wrong@2026" });
  await request(app).post("/api/auth/login").send({ email: "nobody@test.local", password: "Wrong@2026" });

  const success = await logs("LOGIN_SUCCESS");
  assert.equal(success.length, 1);
  assert.equal(String(success[0].user_id), String(users.patient.id));
  assert.equal(String(success[0].entity_id), String(users.patient.id));

  const failed = await logs("LOGIN_FAILED");
  assert.equal(failed.length, 2);
  assert.equal(failed[0].user_id, null);
  assert.equal(String(failed[0].entity_id), String(users.patient.id));
  assert.equal(failed[0].entity_type, "USER");
  assert.equal(failed[1].user_id, null);
  assert.equal(failed[1].entity_id, null);
  assert.equal(failed[1].entity_type, null);
  assert.equal(failed[1].description, "Failed sign-in for an unknown email.");

  for (const entry of [...success, ...failed]) {
    assert.doesNotMatch(entry.description, /@|Known|Wrong/);
  }

  const listed = await request(app)
    .get("/api/admin/activity-logs?action=LOGIN_FAILED")
    .set("Authorization", bearer(users.admin));
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.items.length, 2);
});

test("an unknown email still runs a bcrypt comparison", async (t) => {
  const compared = [];
  t.mock.method(bcrypt, "compare", async (password, hash) => {
    compared.push(hash);
    return false;
  });

  await assert.rejects(
    loginService.login({ email: "nobody@test.local", password: "Wrong@2026" }),
    loginService.InvalidCredentialsError,
  );

  assert.equal(compared.length, 1);
  assert.match(compared[0], /^\$2[aby]\$12\$/);
});

test("clinical and coordination changes are logged with actor and entity", async () => {
  const admin = bearer(users.admin);
  const doctor = bearer(users.doctor);

  const workload = await request(app)
    .patch(`/api/admin/doctors/${users.doctorProfile.id}/workload`)
    .set("Authorization", admin)
    .send({ availability: "AVAILABLE", capacity_limit: 5 });
  assert.equal(workload.status, 200);

  const assignment = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", admin)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Audit trail check",
    });
  assert.equal(assignment.status, 201);
  const assignmentId = assignment.body.data.assignment.id;

  const record = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", doctor)
    .send({ blood_type: "O+" });
  assert.equal(record.status, 201);

  const recordUpdate = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", doctor)
    .send({ allergies: "Penicillin" });
  assert.equal(recordUpdate.status, 200);

  const diagnosis = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/diagnoses`)
    .set("Authorization", doctor)
    .send({ diagnosis: "Migraine under evaluation" });
  assert.equal(diagnosis.status, 201);

  const plan = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", doctor)
    .send({ title: "Headache plan", start_date: "2026-11-28" });
  assert.equal(plan.status, 201);
  const planId = plan.body.data.treatment_plan.id;

  const planUpdate = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${planId}`)
    .set("Authorization", doctor)
    .send({ title: "Headache plan v2" });
  assert.equal(planUpdate.status, 200);

  const close = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${assignmentId}/status`)
    .set("Authorization", admin)
    .send({ status: "INACTIVE" });
  assert.equal(close.status, 200);

  const expected = [
    ["UPDATE_DOCTOR_WORKLOAD", users.admin.id, "DOCTOR", users.doctorProfile.id],
    ["CREATE_DOCTOR_PATIENT_ASSIGNMENT", users.admin.id, "DOCTOR_PATIENT_ASSIGNMENT", assignmentId],
    ["CREATE_MEDICAL_RECORD", users.doctor.id, "MEDICAL_RECORD", record.body.data.medical_record.id],
    ["UPDATE_MEDICAL_RECORD", users.doctor.id, "MEDICAL_RECORD", record.body.data.medical_record.id],
    ["CREATE_DIAGNOSIS", users.doctor.id, "DOCTOR_DIAGNOSIS", diagnosis.body.data.diagnosis.id],
    ["CREATE_TREATMENT_PLAN", users.doctor.id, "TREATMENT_PLAN", planId],
    ["UPDATE_TREATMENT_PLAN", users.doctor.id, "TREATMENT_PLAN", planId],
    ["UPDATE_DOCTOR_PATIENT_ASSIGNMENT_STATUS", users.admin.id, "DOCTOR_PATIENT_ASSIGNMENT", assignmentId],
  ];

  const entries = await db("activity_logs").orderBy("id", "asc");
  assert.deepEqual(
    entries.map((entry) => [entry.action, String(entry.user_id), entry.entity_type, String(entry.entity_id)]),
    expected.map(([action, actor, type, id]) => [action, String(actor), type, String(id)]),
  );

  // Descriptions say what happened, never the record content.
  for (const entry of entries) {
    assert.doesNotMatch(entry.description, /O\+|Penicillin|Migraine|Headache/);
  }
  assert.match(entries.at(-1).description, /status updated to INACTIVE\.$/);
});

test("moving an intake to review is logged", async () => {
  await db("patient_intakes").del();
  const submission = await request(app)
    .post("/api/patient/intake")
    .set("Authorization", bearer(users.patient))
    .send(patientIntakePayload());
  assert.equal(submission.status, 201);

  const review = await request(app)
    .patch(`/api/admin/patient-intakes/${submission.body.data.intake.id}/start-review`)
    .set("Authorization", bearer(users.admin));
  assert.equal(review.status, 200);

  const entries = await logs("START_INTAKE_REVIEW");
  assert.equal(entries.length, 1);
  assert.equal(String(entries[0].user_id), String(users.admin.id));
  assert.equal(entries[0].entity_type, "PATIENT_INTAKE");
  assert.equal(String(entries[0].entity_id), String(submission.body.data.intake.id));
});

test("a failed clinical change leaves no log entry", async () => {
  // No assignment: the doctor may not create a record, and nothing is logged.
  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/medical-record`)
    .set("Authorization", bearer(users.doctor))
    .send({ blood_type: "O+" });

  assert.equal(response.status, 403);
  assert.equal((await db("activity_logs")).length, 0);
});
