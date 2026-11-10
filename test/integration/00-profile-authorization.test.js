const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Profile Authorization and Account Workflows
registerIntegrationHooks();

test("GET /api/profile rejects unauthenticated requests", async () => {
  const response = await request(app).get("/api/profile");

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("GET /api/profile returns only the authenticated patient profile", async () => {
  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.profile.id, users.patient.id);
  assert.equal(response.body.data.profile.role, "PATIENT");
  assert.equal(response.body.data.profile.email, users.patient.email);
  assert.equal(response.body.data.profile.national_id, "123456789");
  assert.equal(response.body.data.profile.gender, "MALE");
  assert.equal(response.body.data.profile.address, "Gaza");

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "specialization",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "organization_name",
    ),
    false,
  );
});

test("GET /api/profile returns doctor-specific profile fields", async () => {
  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.profile.id, users.doctor.id);
  assert.equal(response.body.data.profile.role, "DOCTOR");
  assert.equal(response.body.data.profile.specialization, "General Medicine");
  assert.equal(response.body.data.profile.license_number, "AUTH-DOCTOR-001");

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "date_of_birth",
    ),
    false,
  );
});

test("GET /api/profile returns NGO-specific profile fields", async () => {
  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.profile.id, users.ngo.id);
  assert.equal(response.body.data.profile.role, "NGO");
  assert.equal(
    response.body.data.profile.organization_name,
    "Authorization Test NGO",
  );
  assert.equal(response.body.data.profile.registration_number, "AUTH-NGO-001");
});

test("GET /api/profile returns only base profile fields for admin", async () => {
  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.profile.id, users.admin.id);
  assert.equal(response.body.data.profile.role, "ADMIN");

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "specialization",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "date_of_birth",
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "organization_name",
    ),
    false,
  );
});

test("authorization uses current database account status", async () => {
  const token = tokenFor(users.patient);

  await db("users")
    .where({ id: users.patient.id })
    .update({ account_status: "INACTIVE" });

  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Account is not active");
});

test("authorization uses current database role instead of stale token role", async () => {
  const token = tokenFor(users.patient);

  await db("patient_intakes").where({ patient_id: users.patientProfile.id }).del();
  await db("patients").where({ user_id: users.patient.id }).del();

  await db("users").where({ id: users.patient.id }).update({ role: "ADMIN" });

  const response = await request(app)
    .get("/api/profile")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.profile.role, "ADMIN");

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      response.body.data.profile,
      "date_of_birth",
    ),
    false,
  );
});

test("patient can update approved patient profile fields", async () => {
  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      full_name: "Updated Authorization Patient",
      address: "Updated Gaza Address",
    });

  assert.equal(response.status, 200);
  assert.equal(
    response.body.data.profile.full_name,
    "Updated Authorization Patient",
  );
  assert.equal(response.body.data.profile.address, "Updated Gaza Address");
});

test("patient-only profile updates refresh the returned profile timestamp", async () => {
  const beforeUpdate = await db("users")
    .where({ id: users.patient.id })
    .first();

  await new Promise((resolve) => setTimeout(resolve, 1100));

  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      address: "Timestamp Test Address",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.profile.address, "Timestamp Test Address");

  const afterUpdate = await db("users").where({ id: users.patient.id }).first();

  assert.ok(
    new Date(afterUpdate.updated_at).getTime() >
      new Date(beforeUpdate.updated_at).getTime(),
  );
});

test("doctor can update approved common profile fields", async () => {
  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      full_name: "Updated Authorization Doctor",
      phone: "0563333333",
    });

  assert.equal(response.status, 200);
  assert.equal(
    response.body.data.profile.full_name,
    "Updated Authorization Doctor",
  );
  assert.equal(response.body.data.profile.phone, "0563333333");
});

test("doctor cannot update protected doctor fields", async () => {
  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      specialization: "Surgery",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.specialization);

  const doctor = await db("doctors")
    .where({ user_id: users.doctor.id })
    .first();

  assert.equal(doctor.specialization, "General Medicine");
});

test("patient cannot update protected or cross-role fields", async () => {
  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      role: "ADMIN",
      specialization: "Surgery",
      national_id: "623456789",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.role);
  assert.ok(response.body.errors.specialization);
  assert.ok(response.body.errors.national_id);

  const patient = await db("users").where({ id: users.patient.id }).first();
  const patientProfile = await db("patients")
    .where({ user_id: users.patient.id })
    .first();

  assert.equal(patient.role, "PATIENT");
  assert.equal(patientProfile.national_id, "123456789");
});

test("NGO cannot update profile through the self-update endpoint", async () => {
  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
    .send({
      full_name: "Changed NGO User",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("admin cannot update profile through the self-update endpoint", async () => {
  const response = await request(app)
    .patch("/api/profile")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      full_name: "Changed Admin",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});
