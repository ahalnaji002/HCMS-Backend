const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  createUser,
  patientIntakePayload,
  insertActiveAssignment,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");
const {
  accessLogEnabled,
  createAccessLog,
  formatAccessLogLine,
} = require("../../src/middleware/accessLog");

// Pre-release C4 (BE-07): the patient-intake flow and the validators that
// had little coverage, plus the access log (BE-17).
registerIntegrationHooks();

function bearer(user) {
  return `Bearer ${tokenFor(user)}`;
}

async function clearIntake() {
  await db("intake_correction_requests").del();
  await db("patient_intakes").del();
}

async function patientWithoutProfile() {
  return createUser({
    fullName: "Profileless Patient",
    email: "profileless.patient@test.local",
    role: "PATIENT",
  });
}

// ---------------------------------------------------------------- patient doctor assignments

test("a patient lists only active doctor assignments with the doctor's name", async () => {
  const empty = await request(app)
    .get("/api/patient/doctor-assignments")
    .set("Authorization", bearer(users.patient));
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data.assignments, []);

  const assignment = await insertActiveAssignment();
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
  });

  const response = await request(app)
    .get("/api/patient/doctor-assignments")
    .set("Authorization", bearer(users.patient));

  assert.equal(response.status, 200);
  assert.equal(response.body.message, "Patient doctor assignments retrieved successfully");
  assert.equal(response.body.data.assignments.length, 1);
  const [listed] = response.body.data.assignments;
  assert.equal(String(listed.id), String(assignment.id));
  assert.equal(listed.status, "ACTIVE");
  assert.equal(listed.doctor_name, users.doctor.full_name);
  assert.equal(listed.specialization, "General Medicine");
});

test("doctor assignments for a patient account without a profile is 404, other roles 403", async () => {
  const profileless = await patientWithoutProfile();
  const missing = await request(app)
    .get("/api/patient/doctor-assignments")
    .set("Authorization", bearer(profileless));
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, "Patient profile not found");

  for (const user of [users.doctor, users.ngo, users.admin]) {
    const response = await request(app)
      .get("/api/patient/doctor-assignments")
      .set("Authorization", bearer(user));
    assert.equal(response.status, 403, user.role);
  }
});

// ---------------------------------------------------------------- intake lifecycle errors

test("intake: update before submit is 404, a second submit is 409", async () => {
  await clearIntake();
  const patient = bearer(users.patient);

  const getEmpty = await request(app).get("/api/patient/intake").set("Authorization", patient);
  assert.equal(getEmpty.status, 200);
  assert.equal(getEmpty.body.data.intake, null);

  const early = await request(app)
    .put("/api/patient/intake")
    .set("Authorization", patient)
    .send(patientIntakePayload());
  assert.equal(early.status, 404);

  const first = await request(app)
    .post("/api/patient/intake")
    .set("Authorization", patient)
    .send(patientIntakePayload());
  assert.equal(first.status, 201);

  const second = await request(app)
    .post("/api/patient/intake")
    .set("Authorization", patient)
    .send(patientIntakePayload());
  assert.equal(second.status, 409);
  assert.equal(second.body.message, "A patient intake has already been submitted");
});

test("intake: a patient account without a profile gets 404 on every intake call", async () => {
  const profileless = bearer(await patientWithoutProfile());

  for (const [method, path, body] of [
    ["get", "/api/patient/intake"],
    ["post", "/api/patient/intake", patientIntakePayload()],
    ["put", "/api/patient/intake", patientIntakePayload()],
    ["get", "/api/patient/intake-correction-requests"],
    ["post", "/api/patient/intake-correction-requests", { message: "Please fix my intake." }],
  ]) {
    const call = request(app)[method](path).set("Authorization", profileless);
    const response = body ? await call.send(body) : await call;
    assert.equal(response.status, 404, `${method} ${path}`);
  }
});

test("intake: review can start once, only from SUBMITTED, and only for an existing intake", async () => {
  await clearIntake();
  const admin = bearer(users.admin);

  const missing = await request(app)
    .patch("/api/admin/patient-intakes/999999/start-review")
    .set("Authorization", admin);
  assert.equal(missing.status, 404);

  const submitted = await request(app)
    .post("/api/patient/intake")
    .set("Authorization", bearer(users.patient))
    .send(patientIntakePayload());
  const intakeId = submitted.body.data.intake.id;

  const first = await request(app)
    .patch(`/api/admin/patient-intakes/${intakeId}/start-review`)
    .set("Authorization", admin);
  assert.equal(first.status, 200);

  const again = await request(app)
    .patch(`/api/admin/patient-intakes/${intakeId}/start-review`)
    .set("Authorization", admin);
  assert.equal(again.status, 409);
  assert.equal(again.body.message, "Only a submitted intake can enter review");

  const invalidId = await request(app)
    .patch("/api/admin/patient-intakes/abc/start-review")
    .set("Authorization", admin);
  assert.equal(invalidId.status, 400);
});

test("intake: a doctor reads it only with an active assignment", async () => {
  const doctor = bearer(users.doctor);
  const path = `/api/doctor/patients/${users.patientProfile.id}/intake`;

  const forbidden = await request(app).get(path).set("Authorization", doctor);
  assert.equal(forbidden.status, 403);

  await insertActiveAssignment();
  const allowed = await request(app).get(path).set("Authorization", doctor);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.intake.current_problem, "Test intake");

  await clearIntake();
  const none = await request(app).get(path).set("Authorization", doctor);
  assert.equal(none.status, 404);

  const unknownPatient = await request(app)
    .get("/api/doctor/patients/999999/intake")
    .set("Authorization", doctor);
  assert.ok([403, 404].includes(unknownPatient.status));
});

test("intake: a doctor account without a doctor profile gets 404", async () => {
  await db("doctors").where({ user_id: users.doctor.id }).del();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/intake`)
    .set("Authorization", bearer(users.doctor));
  assert.equal(response.status, 404);
});

// ---------------------------------------------------------------- correction requests

test("correction requests: not before an intake, not while it is still SUBMITTED", async () => {
  await clearIntake();
  const patient = bearer(users.patient);
  const body = { message: "Please add my newly reported symptom." };

  const noIntake = await request(app)
    .post("/api/patient/intake-correction-requests")
    .set("Authorization", patient)
    .send(body);
  assert.equal(noIntake.status, 409);
  assert.equal(noIntake.body.message, "Submit a patient intake before requesting a correction");

  await request(app).post("/api/patient/intake").set("Authorization", patient).send(patientIntakePayload());

  const stillSubmitted = await request(app)
    .post("/api/patient/intake-correction-requests")
    .set("Authorization", patient)
    .send(body);
  assert.equal(stillSubmitted.status, 409);
  assert.equal(
    stillSubmitted.body.message,
    "Correction requests are available after administration starts review",
  );
});

test("correction requests: listed for the patient, resolved once, 404 when missing", async () => {
  const patient = bearer(users.patient);
  const admin = bearer(users.admin);

  const created = await request(app)
    .post("/api/patient/intake-correction-requests")
    .set("Authorization", patient)
    .send({ message: "Please correct my allergy answer." });
  assert.equal(created.status, 201);
  const requestId = created.body.data.request.id;

  const own = await request(app)
    .get("/api/patient/intake-correction-requests")
    .set("Authorization", patient);
  assert.equal(own.status, 200);
  assert.equal(own.body.data.requests.length, 1);
  assert.equal(own.body.data.requests[0].status, "OPEN");

  const missing = await request(app)
    .patch("/api/admin/intake-correction-requests/999999/resolve")
    .set("Authorization", admin)
    .send({ admin_response: "Done." });
  assert.equal(missing.status, 404);

  const resolved = await request(app)
    .patch(`/api/admin/intake-correction-requests/${requestId}/resolve`)
    .set("Authorization", admin)
    .send({ admin_response: "Recorded." });
  assert.equal(resolved.status, 200);

  const twice = await request(app)
    .patch(`/api/admin/intake-correction-requests/${requestId}/resolve`)
    .set("Authorization", admin)
    .send({ admin_response: "Recorded again." });
  assert.equal(twice.status, 409);
  assert.equal(twice.body.message, "Intake correction request is already resolved");
});

// ---------------------------------------------------------------- diagnosis validator

test("diagnosis validation: object body, only `diagnosis`, non-empty, size limit, trimmed", async () => {
  await insertActiveAssignment();
  const doctor = bearer(users.doctor);
  const path = `/api/doctor/patients/${users.patientProfile.id}/diagnoses`;

  const arrayBody = await request(app)
    .post(path)
    .set("Authorization", doctor)
    .set("Content-Type", "application/json")
    .send("[]");
  assert.equal(arrayBody.status, 400);
  assert.equal(arrayBody.body.errors.body, "request body must be a JSON object");

  const cases = [
    [{}, { diagnosis: "diagnosis is required and must be a string" }],
    [{ diagnosis: 5 }, { diagnosis: "diagnosis is required and must be a string" }],
    [{ diagnosis: "   " }, { diagnosis: "diagnosis must not be empty" }],
    [{ diagnosis: "x".repeat(65536) }, { diagnosis: "diagnosis must not exceed 65535 UTF-8 bytes" }],
    [{ diagnosis: "Flu", doctor_id: 1 }, { doctor_id: "doctor_id is not allowed" }],
  ];
  for (const [body, errors] of cases) {
    const response = await request(app).post(path).set("Authorization", doctor).send(body);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 60));
    assert.deepEqual(response.body.errors, errors);
  }

  const trimmed = await request(app)
    .post(path)
    .set("Authorization", doctor)
    .send({ diagnosis: "  Seasonal flu  " });
  assert.equal(trimmed.status, 201);
  assert.equal(trimmed.body.data.diagnosis.diagnosis, "Seasonal flu");
});

// ---------------------------------------------------------------- login validator

test("login validation: email format and length, password required, email trimmed", async () => {
  const cases = [
    [{}, ["email", "password"]],
    [{ email: "not-an-email", password: "x" }, ["email"]],
    [{ email: `${"a".repeat(250)}@test.local`, password: "x" }, ["email"]],
    [{ email: "someone@test.local", password: "" }, ["password"]],
    [{ email: "someone@test.local", password: 123 }, ["password"]],
  ];
  for (const [body, fields] of cases) {
    const response = await request(app).post("/api/auth/login").send(body);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 60));
    assert.deepEqual(Object.keys(response.body.errors).sort(), fields);
  }

  // Surrounding spaces are removed before the lookup, so this reaches the
  // credential check (401) instead of failing validation.
  const padded = await request(app)
    .post("/api/auth/login")
    .send({ email: `  ${users.patient.email}  `, password: "Wrong@2026" });
  assert.equal(padded.status, 401);
  const failed = await db("activity_logs").where({ action: "LOGIN_FAILED" }).first();
  assert.equal(String(failed.entity_id), String(users.patient.id));
});

// ---------------------------------------------------------------- profile update validator

test("profile update validation for patients", async () => {
  const patient = bearer(users.patient);
  const cases = [
    [{}, { body: "At least one profile field is required" }],
    [{ email: "x@test.local" }, { email: "email is not allowed" }],
    [{ full_name: "  " }, { full_name: "full_name must be a non-empty string" }],
    [{ full_name: "x".repeat(151) }, { full_name: "full_name must not exceed 150 characters" }],
    [{ phone: "0123" }, { phone: "phone must be exactly 10 digits and start with 059 or 056" }],
    [{ date_of_birth: "2020-02-30" }, { date_of_birth: "date_of_birth must be a valid date in YYYY-MM-DD format" }],
    [{ date_of_birth: "2999-01-01" }, { date_of_birth: "date_of_birth must not be in the future" }],
    [{ gender: "OTHER" }, { gender: "gender must be exactly MALE or FEMALE" }],
    [{ address: 5 }, { address: "address must be a string" }],
    [{ address: "x".repeat(256) }, { address: "address must not exceed 255 characters" }],
  ];
  for (const [body, errors] of cases) {
    const response = await request(app).patch("/api/profile").set("Authorization", patient).send(body);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 60));
    assert.deepEqual(response.body.errors, errors, JSON.stringify(body).slice(0, 60));
  }

  const updated = await request(app)
    .patch("/api/profile")
    .set("Authorization", patient)
    .send({
      full_name: "  Updated Patient  ",
      phone: null,
      date_of_birth: "1999-05-05",
      gender: "FEMALE",
      address: "  Khan Younis  ",
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.profile.full_name, "Updated Patient");
  assert.equal(updated.body.data.profile.phone, null);
  assert.equal(updated.body.data.profile.date_of_birth, "1999-05-05");
  assert.equal(updated.body.data.profile.gender, "FEMALE");
  assert.equal(updated.body.data.profile.address, "Khan Younis");

  const clearedAddress = await request(app)
    .patch("/api/profile")
    .set("Authorization", patient)
    .send({ address: null });
  assert.equal(clearedAddress.status, 200);
  assert.equal(clearedAddress.body.data.profile.address, null);
});

test("profile update validation for doctors and blocked roles", async () => {
  const doctorFields = await request(app)
    .patch("/api/profile")
    .set("Authorization", bearer(users.doctor))
    .send({ gender: "MALE", address: "Gaza" });
  assert.equal(doctorFields.status, 400);
  assert.deepEqual(doctorFields.body.errors, {
    gender: "gender is not allowed",
    address: "address is not allowed",
  });

  const doctorName = await request(app)
    .patch("/api/profile")
    .set("Authorization", bearer(users.doctor))
    .send({ full_name: "Dr. Updated", phone: "0599999999" });
  assert.equal(doctorName.status, 200);
  assert.equal(doctorName.body.data.profile.full_name, "Dr. Updated");

  for (const user of [users.ngo, users.admin]) {
    const response = await request(app)
      .patch("/api/profile")
      .set("Authorization", bearer(user))
      .send({ full_name: "Nope" });
    assert.equal(response.status, 403, user.role);
  }
});

// ---------------------------------------------------------------- access log (BE-17)

test("access log: on by default, off in tests or with ACCESS_LOG=off", () => {
  assert.equal(accessLogEnabled({ NODE_ENV: "production" }), true);
  assert.equal(accessLogEnabled({}), true);
  assert.equal(accessLogEnabled({ NODE_ENV: "test" }), false);
  assert.equal(accessLogEnabled({ NODE_ENV: "production", ACCESS_LOG: "off" }), false);
  assert.equal(accessLogEnabled({ NODE_ENV: "test", ACCESS_LOG: "on" }), true);
});

test("access log: method, path without query, status, duration and user id only", async () => {
  const express = require("express");
  const lines = [];
  const logged = express();
  logged.use(createAccessLog({ write: (line) => lines.push(line), enabled: true }));
  logged.use(express.json());
  logged.post("/api/things/:id", (req, res) => {
    req.user = { id: 42 };
    res.status(201).json({ ok: true });
  });
  logged.get("/anonymous", (req, res) => res.status(404).end());

  await request(logged)
    .post("/api/things/7?search=Ahmed%20Patient&token=secret")
    .set("Authorization", "Bearer secret-token")
    .send({ password: "Secret@2026" });
  await request(logged).get("/anonymous");

  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\d{4}-\d{2}-\d{2}T\S+Z POST \/api\/things\/7 201 \d+ms user=42$/);
  assert.match(lines[1], /^\S+ GET \/anonymous 404 \d+ms$/);
  for (const line of lines) {
    assert.doesNotMatch(line, /search|Ahmed|token|secret|Secret|password/i);
  }

  assert.equal(
    formatAccessLogLine({ time: "T", method: "GET", path: "/p", status: 200, durationMs: 3 }),
    "T GET /p 200 3ms",
  );

  const silent = [];
  const off = express();
  off.use(createAccessLog({ write: (line) => silent.push(line), enabled: false }));
  off.get("/", (req, res) => res.end());
  await request(off).get("/");
  assert.deepEqual(silent, []);
});
