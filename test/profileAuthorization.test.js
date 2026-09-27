const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/app");
const db = require("../src/config/database");
const { registerDoctor } = require("../src/services/doctorRegistrationService");
const { registerNgo } = require("../src/services/ngoRegistrationService");
const { registerPatient } = require("../src/services/patientRegistrationService");
const { signToken } = require("../src/services/tokenService");
const systemSettingsSeed = require("../database/seeds/002_system_settings");

const TEST_PASSWORD_HASH = "test-password-hash";

let users;

let testDatabaseVerified = false;

async function verifyTestDatabase() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Authorization tests require NODE_ENV=test");
  }

  if (!process.env.TEST_DB_NAME) {
    throw new Error("TEST_DB_NAME is required");
  }

  if (process.env.TEST_DB_NAME === process.env.DB_NAME) {
    throw new Error("TEST_DB_NAME must differ from DB_NAME");
  }

  const result = await db.raw("SELECT DATABASE() AS database_name");
  const databaseName = result[0][0].database_name;

  if (databaseName !== process.env.TEST_DB_NAME) {
    throw new Error(
      `Refusing to run tests against unexpected database: ${databaseName}`,
    );
  }

  testDatabaseVerified = true;
}

function assertTestDatabaseVerified() {
  if (!testDatabaseVerified) {
    throw new Error(
      "Refusing to modify database before test database verification",
    );
  }
}

async function createUser({
  fullName,
  email,
  role,
  accountStatus = "ACTIVE",
  phone = null,
}) {
  const [id] = await db("users").insert({
    full_name: fullName,
    email,
    password_hash: TEST_PASSWORD_HASH,
    role,
    account_status: accountStatus,
    phone,
  });

  return db("users").where({ id }).first();
}

async function createFixtures() {
  const patient = await createUser({
    fullName: "Authorization Patient",
    email: "auth.patient@test.local",
    role: "PATIENT",
    phone: "0591111111",
  });

  await db("patients").insert({
    user_id: patient.id,
    national_id: "123456789",
    date_of_birth: "2000-01-15",
    gender: "MALE",
    address: "Gaza",
  });

  const doctor = await createUser({
    fullName: "Authorization Doctor",
    email: "auth.doctor@test.local",
    role: "DOCTOR",
    phone: "0561111111",
  });

  await db("doctors").insert({
    user_id: doctor.id,
    specialization: "General Medicine",
    license_number: "AUTH-DOCTOR-001",
  });

  const ngo = await createUser({
    fullName: "Authorization NGO User",
    email: "auth.ngo@test.local",
    role: "NGO",
  });

  await db("ngos").insert({
    user_id: ngo.id,
    organization_name: "Authorization Test NGO",
    registration_number: "AUTH-NGO-001",
    address: "Gaza",
    contact_phone: "0592222222",
  });

  const admin = await createUser({
    fullName: "Authorization Admin",
    email: "auth.admin@test.local",
    role: "ADMIN",
  });

  const patientProfile = await db("patients")
    .where({ user_id: patient.id })
    .first();

  const doctorProfile = await db("doctors")
    .where({ user_id: doctor.id })
    .first();

  return {
    patient,
    doctor,
    ngo,
    admin,
    patientProfile,
    doctorProfile,
  };
}

function tokenFor(user) {
  return signToken(user);
}

function patientRegistration(overrides = {}) {
  return {
    full_name: "Sprint Five Patient",
    email: "sprint5.patient@test.local",
    password: "Secure123",
    password_confirmation: "Secure123",
    phone: "0591234567",
    national_id: "523456789",
    date_of_birth: "1995-04-12",
    gender: "FEMALE",
    address: "Gaza",
    ...overrides,
  };
}

function doctorRegistration(overrides = {}) {
  return {
    full_name: "Sprint Five Doctor",
    email: "sprint5.doctor@test.local",
    password: "Secure123",
    password_confirmation: "Secure123",
    phone: "0561234567",
    specialization: "General Medicine",
    license_number: "SPRINT5-DOC-001",
    ...overrides,
  };
}

function ngoRegistration(overrides = {}) {
  return {
    full_name: "Sprint Five NGO User",
    email: "sprint5.ngo@test.local",
    password: "Secure123",
    password_confirmation: "Secure123",
    phone: "0597654321",
    organization_name: "Sprint Five NGO",
    registration_number: "SPRINT5-NGO-001",
    address: "Gaza",
    ...overrides,
  };
}

before(async () => {
  await verifyTestDatabase();
});

beforeEach(async () => {
  assertTestDatabaseVerified();

  await db("activity_logs").del();
  await db("system_settings").del();
  await db("notifications").del();
  await db("reminders").del();
  await db("messages").del();
  await db("resource_allocations").del();
  await db("assistance_requests").del();
  await db("emergency_alerts").del();
  await db("medical_notes").del();
  await db("treatment_medications").del();
  await db("treatment_appointments").del();
  await db("treatment_plans").del();
  await db("medical_records").del();
  await db("doctor_patient_assignments").del();
  await db("join_requests").del();
  await db("ngos").del();
  await db("doctors").del();
  await db("patients").del();
  await db("users").del();

  users = await createFixtures();
});

after(async () => {
  try {
    if (testDatabaseVerified) {
      await db("activity_logs").del();
      await db("system_settings").del();
      await db("notifications").del();
      await db("reminders").del();
      await db("messages").del();
      await db("resource_allocations").del();
      await db("assistance_requests").del();
      await db("emergency_alerts").del();
      await db("medical_notes").del();
      await db("treatment_medications").del();
      await db("treatment_appointments").del();
      await db("treatment_plans").del();
      await db("medical_records").del();
      await db("doctor_patient_assignments").del();
      await db("join_requests").del();
      await db("ngos").del();
      await db("doctors").del();
      await db("patients").del();
      await db("users").del();
    }
  } finally {
    await db.destroy();
  }
});

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

// ==============================
// Doctor-Patient Assignment Creation
// ==============================

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

test("assignment_reason and notes are optional", async () => {
  const response = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.assignment.status, "ACTIVE");
  assert.equal(response.body.data.assignment.assignment_reason, null);
  assert.equal(response.body.data.assignment.notes, null);
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

// ==============================
// Doctor-Patient Assignment Viewing
// ==============================

async function insertAssignment(overrides = {}) {
  const [id] = await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
    assignment_reason: "Assignment viewing test",
    notes: "Approved assignment notes",
    ...overrides,
  });

  return db("doctor_patient_assignments").where({ id }).first();
}

test("GET assignment list rejects unauthenticated requests", async () => {
  const response = await request(app).get(
    "/api/admin/doctor-patient-assignments",
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("GET assignment list rejects non-admin users", async () => {
  const response = await request(app)
    .get("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("admin can list active and historical assignments", async () => {
  await insertAssignment({
    status: "INACTIVE",
    assigned_at: "2026-09-17 08:00:00",
    ended_at: "2026-09-18 08:00:00",
  });
  await insertAssignment({ assigned_at: "2026-09-19 08:00:00" });

  const response = await request(app)
    .get("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.message,
    "Doctor-patient assignments retrieved successfully",
  );
  assert.equal(response.body.data.assignments.length, 2);
  assert.deepEqual(
    response.body.data.assignments.map((assignment) => assignment.status),
    ["ACTIVE", "INACTIVE"],
  );
});

test("assignment list uses deterministic newest-first ordering", async () => {
  const oldest = await insertAssignment({
    status: "INACTIVE",
    assigned_at: "2026-09-17 08:00:00",
    ended_at: "2026-09-18 08:00:00",
  });
  const firstNewest = await insertAssignment({
    status: "INACTIVE",
    assigned_at: "2026-09-19 08:00:00",
    ended_at: "2026-09-19 09:00:00",
  });
  const secondNewest = await insertAssignment({
    assigned_at: "2026-09-19 08:00:00",
  });

  const response = await request(app)
    .get("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.assignments.map((assignment) => Number(assignment.id)),
    [secondNewest.id, firstNewest.id, oldest.id],
  );
});

test("assignment list exposes only approved assignment fields", async () => {
  await insertAssignment();

  const response = await request(app)
    .get("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body.data.assignments[0]).sort(), [
    "assigned_at",
    "assignment_reason",
    "created_at",
    "doctor_id",
    "ended_at",
    "id",
    "notes",
    "patient_id",
    "status",
    "updated_at",
  ]);
});

test("GET assignment detail rejects unauthenticated requests", async () => {
  const assignment = await insertAssignment();
  const response = await request(app).get(
    `/api/admin/doctor-patient-assignments/${assignment.id}`,
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("GET assignment detail rejects non-admin users", async () => {
  const assignment = await insertAssignment();
  const response = await request(app)
    .get(`/api/admin/doctor-patient-assignments/${assignment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("admin can view an existing assignment", async () => {
  const assignment = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-19 10:00:00",
  });

  const response = await request(app)
    .get(`/api/admin/doctor-patient-assignments/${assignment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.message,
    "Doctor-patient assignment retrieved successfully",
  );
  assert.equal(Number(response.body.data.assignment.id), assignment.id);
  assert.equal(response.body.data.assignment.status, "INACTIVE");
  assert.equal(
    response.body.data.assignment.assignment_reason,
    "Assignment viewing test",
  );
});

test("assignment detail returns 404 when the assignment does not exist", async () => {
  const response = await request(app)
    .get("/api/admin/doctor-patient-assignments/999999999")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    message: "Doctor-patient assignment not found",
  });
});

test("assignment detail safely rejects an invalid assignment ID", async () => {
  const response = await request(app)
    .get("/api/admin/doctor-patient-assignments/not-an-id")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    success: false,
    message: "Validation failed",
    errors: { id: "id must be a positive integer" },
  });
});

test("assignment detail excludes unrelated patient and user data", async () => {
  const assignment = await insertAssignment();

  const response = await request(app)
    .get(`/api/admin/doctor-patient-assignments/${assignment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);

  const returnedAssignment = response.body.data.assignment;
  assert.equal(Object.hasOwn(returnedAssignment, "date_of_birth"), false);
  assert.equal(Object.hasOwn(returnedAssignment, "gender"), false);
  assert.equal(Object.hasOwn(returnedAssignment, "address"), false);
  assert.equal(Object.hasOwn(returnedAssignment, "email"), false);
  assert.equal(Object.hasOwn(returnedAssignment, "password_hash"), false);
  assert.equal(Object.hasOwn(returnedAssignment, "patient"), false);
  assert.equal(Object.hasOwn(returnedAssignment, "doctor"), false);
});

// ==============================
// Doctor-Patient Assignment Status Updates
// ==============================

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

// ==============================
// Single Active Assignment Invariant
// ==============================

test("multiple inactive historical assignments are allowed for the same pair", async () => {
  const first = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-17 10:00:00",
  });
  const second = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-18 10:00:00",
  });

  const historicalAssignments = await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      status: "INACTIVE",
    })
    .orderBy("id", "asc");

  assert.equal(historicalAssignments.length, 2);
  assert.deepEqual(
    historicalAssignments.map((assignment) => assignment.id),
    [first.id, second.id],
  );
});

test("deactivation allows a new active assignment while preserving history", async () => {
  const original = await insertAssignment({
    assignment_reason: "Original assignment",
  });
  const token = tokenFor(users.admin);

  const deactivationResponse = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${original.id}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "INACTIVE" });

  assert.equal(deactivationResponse.status, 200);

  const creationResponse = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${token}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Replacement assignment",
    });

  assert.equal(creationResponse.status, 201);

  const assignments = await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    })
    .orderBy("id", "asc");

  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].id, original.id);
  assert.equal(assignments[0].status, "INACTIVE");
  assert.ok(assignments[0].ended_at);
  assert.equal(assignments[0].assignment_reason, "Original assignment");
  assert.equal(assignments[1].status, "ACTIVE");
  assert.equal(assignments[1].ended_at, null);
  assert.equal(assignments[1].assignment_reason, "Replacement assignment");
});

test("concurrent creation and reactivation preserve one active assignment", async () => {
  const historical = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-18 10:00:00",
  });
  const token = tokenFor(users.admin);

  const [creationResponse, reactivationResponse] = await Promise.all([
    request(app)
      .post("/api/admin/doctor-patient-assignments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        doctor_id: users.doctorProfile.id,
        patient_id: users.patientProfile.id,
        assignment_reason: "Concurrent replacement",
      }),
    request(app)
      .patch(`/api/admin/doctor-patient-assignments/${historical.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACTIVE" }),
  ]);

  const responses = [creationResponse, reactivationResponse];
  const conflictResponses = responses.filter(
    (response) => response.status === 409,
  );
  const successfulResponses = responses.filter(
    (response) => response.status === 200 || response.status === 201,
  );

  assert.equal(conflictResponses.length, 1);
  assert.equal(successfulResponses.length, 1);
  assert.equal(
    conflictResponses[0].body.message,
    "An active assignment already exists for this doctor and patient",
  );

  const assignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
  });
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "ACTIVE",
  );

  assert.equal(activeAssignments.length, 1);
  assert.ok(assignments.some((assignment) => assignment.id === historical.id));
});

async function insertMedicalRecord(overrides = {}) {
  const [id] = await db("medical_records").insert({
    patient_id: users.patientProfile.id,
    blood_type: "O+",
    allergies: "None",
    chronic_diseases: null,
    medical_history: "Test medical history",
    previous_surgeries: null,
    ...overrides,
  });

  return db("medical_records").where({ id }).first();
}

async function insertActiveAssignment() {
  const [id] = await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  return db("doctor_patient_assignments").where({ id }).first();
}

async function insertMedicalNote(overrides = {}) {
  let medicalRecord = await db("medical_records")
    .where({ patient_id: users.patientProfile.id })
    .first();

  if (!medicalRecord) {
    medicalRecord = await insertMedicalRecord();
  }

  const [id] = await db("medical_notes").insert({
    medical_record_id: medicalRecord.id,
    doctor_id: users.doctorProfile.id,
    note: "Test medical note",
    ...overrides,
  });

  return db("medical_notes").where({ id }).first();
}

async function createSecondDoctor() {
  const doctorUser = await createUser({
    fullName: "Second Authorization Doctor",
    email: "auth.doctor2@test.local",
    role: "DOCTOR",
    phone: "0562222222",
  });

  const [doctorId] = await db("doctors").insert({
    user_id: doctorUser.id,
    specialization: "Internal Medicine",
    license_number: "AUTH-DOCTOR-002",
  });

  const doctorProfile = await db("doctors").where({ id: doctorId }).first();

  return {
    user: doctorUser,
    profile: doctorProfile,
  };
}

async function insertTreatmentPlan(overrides = {}) {
  const [id] = await db("treatment_plans").insert({
    patient_id: users.patientProfile.id,
    doctor_id: users.doctorProfile.id,
    title: "Test Treatment Plan",
    general_instructions: "Follow the treatment instructions.",
    status: "ACTIVE",
    start_date: "2026-09-21",
    end_date: "2026-10-21",
    ...overrides,
  });

  return db("treatment_plans").where({ id }).first();
}

async function insertTreatmentMedication(planId, overrides = {}) {
  const [id] = await db("treatment_medications").insert({
    treatment_plan_id: planId,
    medication_name: "Metformin",
    dosage: "500 mg",
    frequency: "Twice daily",
    duration: "30 days",
    instructions: "Take with meals.",
    ...overrides,
  });

  return db("treatment_medications").where({ id }).first();
}

async function insertTreatmentAppointment(planId, overrides = {}) {
  const [id] = await db("treatment_appointments").insert({
    treatment_plan_id: planId,
    appointment_date: "2026-10-15 10:30:00",
    purpose: "Routine follow-up",
    location: "Clinic A",
    status: "SCHEDULED",
    notes: "Bring recent test results.",
    ...overrides,
  });

  return db("treatment_appointments").where({ id }).first();
}

async function createSecondPatient() {
  const patientUser = await createUser({
    fullName: "Second Treatment Patient",
    email: "treatment.patient2@test.local",
    role: "PATIENT",
    phone: "0593333333",
  });

  const [patientId] = await db("patients").insert({
    user_id: patientUser.id,
    national_id: "223456789",
    date_of_birth: "2001-01-01",
    gender: "FEMALE",
    address: "Gaza",
  });

  return {
    user: patientUser,
    profile: await db("patients").where({ id: patientId }).first(),
  };
}

// ==============================
// Doctor Assigned-Patient Access
// ==============================

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

// ==============================
// Medical Record Management
// ==============================

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

// ==============================
// Medical Notes Management
// ==============================

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

// ==============================
// Treatment Plans Management
// ==============================

test("POST treatment plan rejects unauthenticated requests", async () => {
  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .send({
      title: "Diabetes Treatment Plan",
      start_date: "2026-09-21",
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("patient cannot use doctor treatment plan endpoints", async () => {
  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("doctor cannot create a treatment plan without an active assignment", async () => {
  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "Diabetes Treatment Plan",
      start_date: "2026-09-21",
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("assigned doctor can create a treatment plan", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "  Diabetes Treatment Plan  ",
      general_instructions: "  Monitor blood sugar daily.  ",
      start_date: "2026-09-21",
      end_date: "2026-10-21",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Treatment Plan created successfully");

  const plan = response.body.data.treatment_plan;

  assert.equal(Number(plan.patient_id), users.patientProfile.id);
  assert.equal(Number(plan.doctor_id), users.doctorProfile.id);
  assert.equal(plan.title, "Diabetes Treatment Plan");
  assert.equal(
    plan.general_instructions,
    "  Monitor blood sugar daily.  ",
  );
  assert.equal(plan.status, "ACTIVE");

  const stored = await db("treatment_plans").where({ id: plan.id }).first();

  assert.ok(stored);
  assert.equal(Number(stored.patient_id), users.patientProfile.id);
  assert.equal(Number(stored.doctor_id), users.doctorProfile.id);
  assert.equal(stored.status, "ACTIVE");
});

test("treatment plan creation rejects missing required fields", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.title);
  assert.ok(response.body.errors.start_date);
});

test("treatment plan creation rejects protected and unknown fields", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "Protected Fields Test",
      start_date: "2026-09-21",
      status: "COMPLETED",
      patient_id: 999,
      doctor_id: 999,
      id: 999,
      created_at: "2026-09-21",
      updated_at: "2026-09-21",
      unexpected_field: "not allowed",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.status);
  assert.ok(response.body.errors.patient_id);
  assert.ok(response.body.errors.doctor_id);
  assert.ok(response.body.errors.id);
  assert.ok(response.body.errors.created_at);
  assert.ok(response.body.errors.updated_at);
  assert.ok(response.body.errors.unexpected_field);

  const plans = await db("treatment_plans");
  assert.equal(plans.length, 0);
});

test("treatment plan creation validates strict calendar dates", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "Invalid Date Plan",
      start_date: "2026-02-30",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.start_date);
});

test("treatment plan routes reject IDs above unsigned BIGINT range", async () => {
  const response = await request(app)
    .get(
      "/api/doctor/patients/18446744073709551616/treatment-plans",
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.patientId);
});

test("treatment plan creation rejects end_date before start_date", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "Invalid Date Range",
      start_date: "2026-10-21",
      end_date: "2026-09-21",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.end_date);
});

test("treatment plan creation allows end_date equal to start_date", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "Single Day Treatment Plan",
      start_date: "2026-09-21",
      end_date: "2026-09-21",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.treatment_plan.status, "ACTIVE");
});

test("assigned doctor gets an empty treatment plans list when no plans exist", async () => {
  await insertActiveAssignment();

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.treatment_plans, []);
});

test("assigned doctor can list all treatment plans for the patient", async () => {
  await insertActiveAssignment();

  const firstPlan = await insertTreatmentPlan({
    title: "First Treatment Plan",
  });

  const secondPlan = await insertTreatmentPlan({
    title: "Second Treatment Plan",
    status: "COMPLETED",
  });

  const response = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.treatment_plans.length, 2);
  assert.deepEqual(
    response.body.data.treatment_plans.map((plan) => Number(plan.id)),
    [firstPlan.id, secondPlan.id],
  );
});

test("assigned doctor can view a treatment plan detail", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .get(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(Number(response.body.data.treatment_plan.id), plan.id);
});

test("assigned doctor can update a treatment plan", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      title: "Updated Treatment Plan",
      status: "COMPLETED",
      general_instructions: "Updated instructions",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Treatment Plan updated successfully");
  assert.equal(
    response.body.data.treatment_plan.title,
    "Updated Treatment Plan",
  );
  assert.equal(response.body.data.treatment_plan.status, "COMPLETED");
  assert.equal(
    Number(response.body.data.treatment_plan.doctor_id),
    users.doctorProfile.id,
  );
});

test("treatment plan update rejects an empty body", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.body);
});

test("treatment plan update rejects invalid status", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      status: "INVALID",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.status);
});

test("treatment plan update rejects protected fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      doctor_id: 999,
      patient_id: 999,
      created_at: "2026-09-21",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.doctor_id);
  assert.ok(response.body.errors.patient_id);
  assert.ok(response.body.errors.created_at);

  const stored = await db("treatment_plans").where({ id: plan.id }).first();

  assert.equal(Number(stored.doctor_id), users.doctorProfile.id);
  assert.equal(Number(stored.patient_id), users.patientProfile.id);
});

test("treatment plan update validates resulting date range when only start_date changes", async () => {
  await insertActiveAssignment();

  const plan = await insertTreatmentPlan({
    start_date: "2026-09-21",
    end_date: "2026-10-21",
  });

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      start_date: "2026-11-01",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "end_date must be greater than or equal to start_date",
  );
});

test("treatment plan update validates resulting date range when only end_date changes", async () => {
  await insertActiveAssignment();

  const plan = await insertTreatmentPlan({
    start_date: "2026-09-21",
    end_date: "2026-10-21",
  });

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      end_date: "2026-09-20",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "end_date must be greater than or equal to start_date",
  );
});

test("treatment plan update can clear end_date", async () => {
  await insertActiveAssignment();

  const plan = await insertTreatmentPlan({
    end_date: "2026-10-21",
  });

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      end_date: null,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.treatment_plan.end_date, null);
});

test("currently assigned doctor can view a treatment plan created by a previous doctor", async () => {
  const plan = await insertTreatmentPlan();

  const secondDoctor = await createSecondDoctor();

  await db("doctor_patient_assignments").insert({
    doctor_id: secondDoctor.profile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  const response = await request(app)
    .get(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(secondDoctor.user)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(Number(response.body.data.treatment_plan.id), plan.id);
  assert.equal(
    Number(response.body.data.treatment_plan.doctor_id),
    users.doctorProfile.id,
  );
});

test("currently assigned doctor can update a previous doctor's treatment plan without changing doctor_id", async () => {
  const plan = await insertTreatmentPlan();

  const originalDoctorId = Number(plan.doctor_id);

  const secondDoctor = await createSecondDoctor();

  await db("doctor_patient_assignments").insert({
    doctor_id: secondDoctor.profile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(secondDoctor.user)}`)
    .send({
      title: "Continued Treatment Plan",
      status: "COMPLETED",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    response.body.data.treatment_plan.title,
    "Continued Treatment Plan",
  );
  assert.equal(
    Number(response.body.data.treatment_plan.doctor_id),
    originalDoctorId,
  );

  const stored = await db("treatment_plans").where({ id: plan.id }).first();

  assert.equal(Number(stored.doctor_id), originalDoctorId);
  assert.notEqual(Number(stored.doctor_id), secondDoctor.profile.id);
});

test("inactive assignment does not authorize treatment plan access", async () => {
  const plan = await insertTreatmentPlan();

  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
    ended_at: db.fn.now(),
  });

  const response = await request(app)
    .get(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("doctor treatment plan detail returns 404 when plan does not belong to scoped patient", async () => {
  await insertActiveAssignment();

  const secondPatientUser = await createUser({
    fullName: "Second Treatment Patient",
    email: "treatment.patient2@test.local",
    role: "PATIENT",
    phone: "0593333333",
  });

  const [secondPatientId] = await db("patients").insert({
    user_id: secondPatientUser.id,
    national_id: "323456789",
    date_of_birth: "2001-01-01",
    gender: "FEMALE",
    address: "Gaza",
  });

  const plan = await insertTreatmentPlan({
    patient_id: secondPatientId,
  });

  const response = await request(app)
    .get(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Treatment Plan not found");
});

test("patient gets an empty treatment plans list when no plans exist", async () => {
  const response = await request(app)
    .get("/api/patient/treatment-plans")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.treatment_plans, []);
});

test("patient can list their own treatment plans", async () => {
  const firstPlan = await insertTreatmentPlan({
    title: "Patient First Plan",
  });

  const secondPlan = await insertTreatmentPlan({
    title: "Patient Second Plan",
  });

  const response = await request(app)
    .get("/api/patient/treatment-plans")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(
    response.body.data.treatment_plans.map((plan) => Number(plan.id)),
    [firstPlan.id, secondPlan.id],
  );
});

test("patient can view their own treatment plan detail", async () => {
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(Number(response.body.data.treatment_plan.id), plan.id);
  assert.equal(
    Number(response.body.data.treatment_plan.patient_id),
    users.patientProfile.id,
  );
});

test("patient cannot view another patient's treatment plan", async () => {
  const secondPatientUser = await createUser({
    fullName: "Second Treatment Patient",
    email: "treatment.patient2@test.local",
    role: "PATIENT",
    phone: "0593333333",
  });

  const [secondPatientId] = await db("patients").insert({
    user_id: secondPatientUser.id,
    national_id: "423456789",
    date_of_birth: "2001-01-01",
    gender: "FEMALE",
    address: "Gaza",
  });

  const plan = await insertTreatmentPlan({
    patient_id: secondPatientId,
  });

  const response = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Treatment Plan not found");
});

test("patient treatment plan detail safely rejects invalid plan ID", async () => {
  const response = await request(app)
    .get("/api/patient/treatment-plans/not-an-id")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.planId);
});

test("patient treatment plan detail returns 404 for missing plan", async () => {
  const response = await request(app)
    .get("/api/patient/treatment-plans/999999999")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Treatment Plan not found");
});

test("treatment plan deletion is not exposed", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .delete(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);

  const stored = await db("treatment_plans").where({ id: plan.id }).first();

  assert.ok(stored);
});

// ==============================
// Treatment Medications Management
// ==============================

test("POST treatment medication rejects unauthenticated requests", async () => {
  const response = await request(app)
    .post("/api/doctor/treatment-plans/1/medications")
    .send({
      medication_name: "Metformin",
      dosage: "500 mg",
      frequency: "Twice daily",
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("patient cannot use doctor treatment medication endpoints", async () => {
  const response = await request(app)
    .get("/api/doctor/treatment-plans/1/medications")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Forbidden");
});

test("doctor cannot access medications without an active assignment", async () => {
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("inactive assignment does not authorize medication access", async () => {
  const plan = await insertTreatmentPlan();
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
    ended_at: db.fn.now(),
  });

  const response = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("assigned doctor can create a treatment medication", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      medication_name: "  Metformin  ",
      dosage: "  500 mg  ",
      frequency: "  Twice daily  ",
      duration: "  30 days  ",
      instructions: "  Take with meals.  ",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Treatment Medication created successfully");
  assert.equal(response.body.data.medication.medication_name, "Metformin");
  assert.equal(response.body.data.medication.dosage, "500 mg");
  assert.equal(response.body.data.medication.frequency, "Twice daily");
  assert.equal(response.body.data.medication.duration, "  30 days  ");
  assert.equal(response.body.data.medication.instructions, "  Take with meals.  ");
  assert.equal(
    Number(response.body.data.medication.treatment_plan_id),
    Number(plan.id),
  );
});

test("treatment medication creation requires approved required fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.medication_name);
  assert.ok(response.body.errors.dosage);
  assert.ok(response.body.errors.frequency);
});

test("treatment medication creation rejects empty required strings", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ medication_name: " ", dosage: " ", frequency: " " });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.medication_name);
  assert.ok(response.body.errors.dosage);
  assert.ok(response.body.errors.frequency);
});

test("treatment medication validation enforces VARCHAR limits", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      medication_name: "M".repeat(151),
      dosage: "D".repeat(101),
      frequency: "F".repeat(101),
      duration: "T".repeat(101),
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.medication_name);
  assert.ok(response.body.errors.dosage);
  assert.ok(response.body.errors.frequency);
  assert.ok(response.body.errors.duration);
});

test("treatment medication validation enforces TEXT UTF-8 byte limit", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      medication_name: "Metformin",
      dosage: "500 mg",
      frequency: "Twice daily",
      instructions: "😀".repeat(16384),
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.instructions);
});

test("treatment medication creation rejects protected and unknown fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      medication_name: "Metformin",
      dosage: "500 mg",
      frequency: "Twice daily",
      id: 99,
      treatment_plan_id: 99,
      created_at: "2026-09-21",
      updated_at: "2026-09-21",
      status: "ACTIVE",
      unexpected: true,
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.id);
  assert.ok(response.body.errors.treatment_plan_id);
  assert.ok(response.body.errors.created_at);
  assert.ok(response.body.errors.updated_at);
  assert.ok(response.body.errors.status);
  assert.ok(response.body.errors.unexpected);
  assert.equal((await db("treatment_medications")).length, 0);
});

test("treatment medication routes safely reject invalid IDs", async () => {
  const invalidPlan = await request(app)
    .get("/api/doctor/treatment-plans/not-an-id/medications")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const invalidMedication = await request(app)
    .get("/api/doctor/treatment-plans/1/medications/not-an-id")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(invalidPlan.status, 400);
  assert.ok(invalidPlan.body.errors.planId);
  assert.equal(invalidMedication.status, 400);
  assert.ok(invalidMedication.body.errors.medicationId);
});

test("treatment medication routes reject IDs above unsigned BIGINT range", async () => {
  const planResponse = await request(app)
    .get("/api/doctor/treatment-plans/18446744073709551616/medications")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const medicationResponse = await request(app)
    .get("/api/doctor/treatment-plans/1/medications/18446744073709551616")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(planResponse.status, 400);
  assert.ok(planResponse.body.errors.planId);
  assert.equal(medicationResponse.status, 400);
  assert.ok(medicationResponse.body.errors.medicationId);
});

test("assigned doctor gets an empty treatment medications list", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.medications, []);
});

test("assigned doctor can list and view treatment medications", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const first = await insertTreatmentMedication(plan.id);
  const second = await insertTreatmentMedication(plan.id, {
    medication_name: "Aspirin",
  });

  const listResponse = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const detailResponse = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/medications/${second.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(listResponse.status, 200);
  assert.deepEqual(
    listResponse.body.data.medications.map((item) => Number(item.id)),
    [first.id, second.id],
  );
  assert.equal(detailResponse.status, 200);
  assert.equal(Number(detailResponse.body.data.medication.id), second.id);
});

test("assigned doctor can partially update a treatment medication", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ dosage: "  850 mg  ", instructions: "  Preserve spacing.  " });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.medication.dosage, "850 mg");
  assert.equal(
    response.body.data.medication.instructions,
    "  Preserve spacing.  ",
  );
  assert.equal(response.body.data.medication.frequency, medication.frequency);
});

test("treatment medication update rejects an empty body", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.body);
});

test("treatment medication update rejects empty required strings", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ medication_name: " ", dosage: " ", frequency: " " });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.medication_name);
  assert.ok(response.body.errors.dosage);
  assert.ok(response.body.errors.frequency);
});

test("treatment medication update rejects invalid optional field types", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ duration: 30, instructions: ["with meals"] });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.duration);
  assert.ok(response.body.errors.instructions);
});

test("treatment medication update allows nullable optional fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ duration: null, instructions: null });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.medication.duration, null);
  assert.equal(response.body.data.medication.instructions, null);
});

test("cross-plan medication detail and update return safe 404", async () => {
  await insertActiveAssignment();
  const firstPlan = await insertTreatmentPlan();
  const secondPlan = await insertTreatmentPlan({ title: "Second Plan" });
  const medication = await insertTreatmentMedication(secondPlan.id);

  const detailResponse = await request(app)
    .get(`/api/doctor/treatment-plans/${firstPlan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const updateResponse = await request(app)
    .patch(`/api/doctor/treatment-plans/${firstPlan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ dosage: "1000 mg" });

  assert.equal(detailResponse.status, 404);
  assert.equal(updateResponse.status, 404);
  const stored = await db("treatment_medications").where({ id: medication.id }).first();
  assert.equal(stored.dosage, medication.dosage);
});

test("medication endpoints return 404 for missing plan and medication", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const missingPlan = await request(app)
    .get("/api/doctor/treatment-plans/999999999/medications")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const missingMedication = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/medications/999999999`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(missingPlan.status, 404);
  assert.equal(missingPlan.body.message, "Treatment Plan not found");
  assert.equal(missingMedication.status, 404);
  assert.equal(missingMedication.body.message, "Treatment Medication not found");
});

test("currently assigned doctor can manage medications on a previous doctor's plan", async () => {
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);
  const secondDoctor = await createSecondDoctor();
  await db("doctor_patient_assignments").insert({
    doctor_id: secondDoctor.profile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(secondDoctor.user)}`)
    .send({ frequency: "Once daily" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.medication.frequency, "Once daily");
  assert.equal(Number(plan.doctor_id), users.doctorProfile.id);
});

test("assigned doctor can delete only a scoped treatment medication", async () => {
  await insertActiveAssignment();
  const firstPlan = await insertTreatmentPlan();
  const secondPlan = await insertTreatmentPlan({ title: "Second Plan" });
  const firstMedication = await insertTreatmentMedication(firstPlan.id);
  const secondMedication = await insertTreatmentMedication(secondPlan.id);

  const crossPlan = await request(app)
    .delete(`/api/doctor/treatment-plans/${firstPlan.id}/medications/${secondMedication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const deleted = await request(app)
    .delete(`/api/doctor/treatment-plans/${firstPlan.id}/medications/${firstMedication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(crossPlan.status, 404);
  assert.ok(await db("treatment_medications").where({ id: secondMedication.id }).first());
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.message, "Treatment Medication deleted successfully");
  assert.equal(await db("treatment_medications").where({ id: firstMedication.id }).first(), undefined);
});

test("patient gets an empty medications list for their own plan", async () => {
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.medications, []);
});

test("patient can list and view medications under their own plan", async () => {
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);

  const listResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const detailResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.data.medications.length, 1);
  assert.equal(detailResponse.status, 200);
  assert.equal(Number(detailResponse.body.data.medication.id), medication.id);
});

test("patient cannot access another patient's plan or medication", async () => {
  const secondPatient = await createSecondPatient();
  const plan = await insertTreatmentPlan({ patient_id: secondPatient.profile.id });
  const medication = await insertTreatmentMedication(plan.id);

  const listResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/medications`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const detailResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(listResponse.status, 404);
  assert.equal(detailResponse.status, 404);
  assert.equal(listResponse.body.message, "Treatment Plan not found");
});

test("patient medication access enforces medication-to-plan ownership", async () => {
  const firstPlan = await insertTreatmentPlan();
  const secondPlan = await insertTreatmentPlan({ title: "Second Plan" });
  const medication = await insertTreatmentMedication(secondPlan.id);

  const response = await request(app)
    .get(`/api/patient/treatment-plans/${firstPlan.id}/medications/${medication.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Treatment Medication not found");
});

test("patient cannot create update or delete treatment medications", async () => {
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);
  const token = `Bearer ${tokenFor(users.patient)}`;

  const createResponse = await request(app)
    .post(`/api/patient/treatment-plans/${plan.id}/medications`)
    .set("Authorization", token)
    .send({ medication_name: "A", dosage: "B", frequency: "C" });
  const updateResponse = await request(app)
    .patch(`/api/patient/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", token)
    .send({ dosage: "Changed" });
  const deleteResponse = await request(app)
    .delete(`/api/patient/treatment-plans/${plan.id}/medications/${medication.id}`)
    .set("Authorization", token);

  assert.equal(createResponse.status, 404);
  assert.equal(updateResponse.status, 404);
  assert.equal(deleteResponse.status, 404);
  assert.ok(await db("treatment_medications").where({ id: medication.id }).first());
});

// ==============================
// Treatment Appointments Management
// ==============================

test("POST treatment appointment rejects unauthenticated requests", async () => {
  const response = await request(app)
    .post("/api/doctor/treatment-plans/1/appointments")
    .send({
      appointment_date: "2026-10-15 10:30:00",
      purpose: "Routine follow-up",
    });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Authentication required");
});

test("GET patient treatment appointments rejects unauthenticated requests", async () => {
  const response = await request(app).get(
    "/api/patient/treatment-plans/1/appointments",
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication required");
});

test("patient cannot use doctor treatment appointment endpoints", async () => {
  const response = await request(app)
    .get("/api/doctor/treatment-plans/1/appointments")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.message, "Forbidden");
});

test("doctor cannot access appointments without an active assignment", async () => {
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.equal(
    response.body.message,
    "Active Doctor-Patient Assignment required",
  );
});

test("inactive assignment does not authorize appointment access", async () => {
  const plan = await insertTreatmentPlan();
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "INACTIVE",
    ended_at: db.fn.now(),
  });

  const response = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
});

test("assigned doctor can create a scheduled treatment appointment", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-15 10:30:00",
      purpose: "  Routine follow-up  ",
      location: "  Clinic A  ",
      notes: "  Bring recent test results.  ",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.appointment.purpose, "Routine follow-up");
  assert.equal(response.body.data.appointment.location, "  Clinic A  ");
  assert.equal(
    response.body.data.appointment.notes,
    "  Bring recent test results.  ",
  );
  assert.equal(response.body.data.appointment.status, "SCHEDULED");
  assert.equal(
    Number(response.body.data.appointment.treatment_plan_id),
    Number(plan.id),
  );
});

test("treatment appointment creation requires appointment_date and purpose", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.appointment_date);
  assert.ok(response.body.errors.purpose);
});

test("treatment appointment rejects malformed impossible and date-only datetimes", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const token = `Bearer ${tokenFor(users.doctor)}`;

  for (const appointmentDate of [
    "not-a-date",
    "2026-02-30 10:00:00",
    "2026-10-15",
    "2026-10-15 24:00:00",
    "0999-10-15 10:00:00",
  ]) {
    const response = await request(app)
      .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
      .set("Authorization", token)
      .send({ appointment_date: appointmentDate, purpose: "Follow-up" });

    assert.equal(response.status, 400);
    assert.ok(response.body.errors.appointment_date);
  }
});

test("treatment appointment creation rejects an empty purpose", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ appointment_date: "2026-10-15 10:30:00", purpose: "   " });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.purpose);
});

test("treatment appointment validation enforces VARCHAR limits", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-15 10:30:00",
      purpose: "P".repeat(256),
      location: "L".repeat(256),
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.purpose);
  assert.ok(response.body.errors.location);
});

test("treatment appointment validation enforces notes UTF-8 TEXT capacity", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-15 10:30:00",
      purpose: "Follow-up",
      notes: "😀".repeat(16384),
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.notes);
});

test("treatment appointment creation accepts nullable optional fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-15 10:30:00",
      purpose: "Follow-up",
      location: null,
      notes: null,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.appointment.location, null);
  assert.equal(response.body.data.appointment.notes, null);
});

test("treatment appointment creation rejects protected and unknown fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-15 10:30:00",
      purpose: "Follow-up",
      status: "COMPLETED",
      treatment_plan_id: 99,
      id: 99,
      created_at: "2026-09-22",
      updated_at: "2026-09-22",
      unexpected: true,
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.status);
  assert.ok(response.body.errors.treatment_plan_id);
  assert.ok(response.body.errors.id);
  assert.ok(response.body.errors.created_at);
  assert.ok(response.body.errors.updated_at);
  assert.ok(response.body.errors.unexpected);
  assert.equal((await db("treatment_appointments")).length, 0);
});

test("treatment appointment create and update reject malformed bodies", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const token = `Bearer ${tokenFor(users.doctor)}`;
  const createResponse = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", token)
    .send([]);
  const updateResponse = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", token)
    .send([]);

  assert.equal(createResponse.status, 400);
  assert.ok(createResponse.body.errors.body);
  assert.equal(updateResponse.status, 400);
  assert.ok(updateResponse.body.errors.body);
});

test("appointment date must not precede the treatment plan start date", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-09-20 23:59:59",
      purpose: "Too early",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.ok(response.body.errors.appointment_date);
});

test("appointment date must not exceed a treatment plan end date", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-22 00:00:00",
      purpose: "Too late",
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.appointment_date);
});

test("appointment plan date boundaries are inclusive", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const token = `Bearer ${tokenFor(users.doctor)}`;

  for (const appointmentDate of [
    "2026-09-21 00:00:00",
    "2026-10-01 12:00:00",
    "2026-10-21 23:59:59",
  ]) {
    const response = await request(app)
      .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
      .set("Authorization", token)
      .send({ appointment_date: appointmentDate, purpose: "Valid date" });
    assert.equal(response.status, 201);
  }
});

test("appointment allows an open-ended plan and has no future-only rule", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({
    start_date: "2020-01-01",
    end_date: null,
  });

  const pastResponse = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2020-01-01 08:00:00",
      purpose: "Past in-range visit",
    });
  const laterResponse = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2035-01-01 08:00:00",
      purpose: "Open-ended visit",
    });

  assert.equal(pastResponse.status, 201);
  assert.equal(laterResponse.status, 201);
});

test("appointment routes reject invalid and out-of-range identifiers", async () => {
  const token = `Bearer ${tokenFor(users.doctor)}`;
  for (const value of [
    "0",
    "-1",
    "1.5",
    "invalid",
    "18446744073709551616",
  ]) {
    const planResponse = await request(app)
      .get(`/api/doctor/treatment-plans/${value}/appointments`)
      .set("Authorization", token);
    const appointmentResponse = await request(app)
      .get(`/api/doctor/treatment-plans/1/appointments/${value}`)
      .set("Authorization", token);

    assert.equal(planResponse.status, 400);
    assert.ok(planResponse.body.errors.planId);
    assert.equal(appointmentResponse.status, 400);
    assert.ok(appointmentResponse.body.errors.appointmentId);
  }
});

test("assigned doctor gets an empty appointments list", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.appointments, []);
});

test("assigned doctor can list and view treatment appointments", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const first = await insertTreatmentAppointment(plan.id);
  const second = await insertTreatmentAppointment(plan.id, {
    purpose: "Second visit",
  });

  const listResponse = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const detailResponse = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments/${second.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(listResponse.status, 200);
  assert.deepEqual(
    listResponse.body.data.appointments.map((item) => Number(item.id)),
    [first.id, second.id],
  );
  assert.equal(detailResponse.status, 200);
  assert.equal(Number(detailResponse.body.data.appointment.id), second.id);
});

test("appointment endpoints return 404 for missing plan and appointment", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const missingPlan = await request(app)
    .get("/api/doctor/treatment-plans/999999999/appointments")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const missingAppointment = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments/999999999`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(missingPlan.status, 404);
  assert.equal(missingPlan.body.message, "Treatment Plan not found");
  assert.equal(missingAppointment.status, 404);
  assert.equal(
    missingAppointment.body.message,
    "Treatment Appointment not found",
  );
});

test("cross-plan appointment detail and update return safe 404", async () => {
  await insertActiveAssignment();
  const firstPlan = await insertTreatmentPlan();
  const secondPlan = await insertTreatmentPlan({ title: "Second Plan" });
  const appointment = await insertTreatmentAppointment(secondPlan.id);

  const detailResponse = await request(app)
    .get(`/api/doctor/treatment-plans/${firstPlan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const updateResponse = await request(app)
    .patch(`/api/doctor/treatment-plans/${firstPlan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ purpose: "Changed" });

  assert.equal(detailResponse.status, 404);
  assert.equal(updateResponse.status, 404);
  const stored = await db("treatment_appointments")
    .where({ id: appointment.id })
    .first();
  assert.equal(stored.purpose, appointment.purpose);
});

test("assigned doctor can partially update every appointment field", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      appointment_date: "2026-10-20 14:00:00",
      purpose: "  Updated purpose  ",
      location: "  Ward B  ",
      status: "COMPLETED",
      notes: "  Updated notes.  ",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.appointment.purpose, "Updated purpose");
  assert.equal(response.body.data.appointment.location, "  Ward B  ");
  assert.equal(response.body.data.appointment.status, "COMPLETED");
  assert.equal(response.body.data.appointment.notes, "  Updated notes.  ");
});

test("appointment update rejects empty bodies and empty purpose", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const path = `/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`;
  const token = `Bearer ${tokenFor(users.doctor)}`;
  const emptyBody = await request(app)
    .patch(path)
    .set("Authorization", token)
    .send({});
  const emptyPurpose = await request(app)
    .patch(path)
    .set("Authorization", token)
    .send({ purpose: " " });

  assert.equal(emptyBody.status, 400);
  assert.ok(emptyBody.body.errors.body);
  assert.equal(emptyPurpose.status, 400);
  assert.ok(emptyPurpose.body.errors.purpose);
});

test("appointment update validates datetime format and plan date range", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const path = `/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`;
  const token = `Bearer ${tokenFor(users.doctor)}`;
  const malformed = await request(app)
    .patch(path)
    .set("Authorization", token)
    .send({ appointment_date: "2026-10-15" });
  const outside = await request(app)
    .patch(path)
    .set("Authorization", token)
    .send({ appointment_date: "2026-10-22 00:00:00" });

  assert.equal(malformed.status, 400);
  assert.ok(malformed.body.errors.appointment_date);
  assert.equal(outside.status, 400);
  assert.ok(outside.body.errors.appointment_date);
});

test("appointment status accepts every approved value without a transition state machine", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const path = `/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`;
  const token = `Bearer ${tokenFor(users.doctor)}`;

  for (const status of ["COMPLETED", "CANCELLED", "SCHEDULED"]) {
    const response = await request(app)
      .patch(path)
      .set("Authorization", token)
      .send({ status });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.appointment.status, status);
  }
});

test("appointment update rejects invalid status nullable types and size limits", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      status: "MISSED",
      purpose: "P".repeat(256),
      location: "L".repeat(256),
      notes: "😀".repeat(16384),
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.status);
  assert.ok(response.body.errors.purpose);
  assert.ok(response.body.errors.location);
  assert.ok(response.body.errors.notes);
});

test("appointment update rejects invalid nullable field types", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ location: 123, notes: ["invalid"] });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.location);
  assert.ok(response.body.errors.notes);
});

test("appointment update allows nullable optional fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ location: null, notes: null });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.appointment.location, null);
  assert.equal(response.body.data.appointment.notes, null);
});

test("appointment update rejects protected and unknown fields", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      id: 99,
      treatment_plan_id: 99,
      created_at: "2026-09-22",
      updated_at: "2026-09-22",
      unexpected: true,
    });

  assert.equal(response.status, 400);
  assert.ok(response.body.errors.id);
  assert.ok(response.body.errors.treatment_plan_id);
  assert.ok(response.body.errors.created_at);
  assert.ok(response.body.errors.updated_at);
  assert.ok(response.body.errors.unexpected);
});

test("currently assigned doctor can manage appointments on a previous doctor's plan", async () => {
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const secondDoctor = await createSecondDoctor();
  await db("doctor_patient_assignments").insert({
    doctor_id: secondDoctor.profile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  const response = await request(app)
    .patch(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(secondDoctor.user)}`)
    .send({ purpose: "Continued care visit" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.appointment.purpose, "Continued care visit");
  assert.equal(Number(plan.doctor_id), users.doctorProfile.id);
});

test("assigned doctor can delete only a scoped appointment", async () => {
  await insertActiveAssignment();
  const firstPlan = await insertTreatmentPlan();
  const secondPlan = await insertTreatmentPlan({ title: "Second Plan" });
  const firstAppointment = await insertTreatmentAppointment(firstPlan.id);
  const secondAppointment = await insertTreatmentAppointment(secondPlan.id);
  const crossPlan = await request(app)
    .delete(`/api/doctor/treatment-plans/${firstPlan.id}/appointments/${secondAppointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  const deleted = await request(app)
    .delete(`/api/doctor/treatment-plans/${firstPlan.id}/appointments/${firstAppointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(crossPlan.status, 404);
  assert.ok(await db("treatment_appointments").where({ id: secondAppointment.id }).first());
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.message, "Treatment Appointment deleted successfully");
  assert.equal(await db("treatment_appointments").where({ id: firstAppointment.id }).first(), undefined);
});

test("doctor without active assignment cannot delete an appointment", async () => {
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app)
    .delete(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
  assert.ok(await db("treatment_appointments").where({ id: appointment.id }).first());
});

test("appointment deletion returns 404 for a missing appointment", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .delete(`/api/doctor/treatment-plans/${plan.id}/appointments/999999999`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Treatment Appointment not found");
});

test("patient gets an empty appointments list for their own plan", async () => {
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.appointments, []);
});

test("patient can list and view appointments under their own plan", async () => {
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const listResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const detailResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.data.appointments.length, 1);
  assert.equal(detailResponse.status, 200);
  assert.equal(Number(detailResponse.body.data.appointment.id), appointment.id);
});

test("patient cannot access another patient's plan or appointment", async () => {
  const secondPatient = await createSecondPatient();
  const plan = await insertTreatmentPlan({ patient_id: secondPatient.profile.id });
  const appointment = await insertTreatmentAppointment(plan.id);
  const listResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const detailResponse = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(listResponse.status, 404);
  assert.equal(detailResponse.status, 404);
  assert.equal(listResponse.body.message, "Treatment Plan not found");
});

test("patient appointment access enforces appointment-to-plan ownership", async () => {
  const firstPlan = await insertTreatmentPlan();
  const secondPlan = await insertTreatmentPlan({ title: "Second Plan" });
  const appointment = await insertTreatmentAppointment(secondPlan.id);
  const response = await request(app)
    .get(`/api/patient/treatment-plans/${firstPlan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Treatment Appointment not found");
});

test("patient appointment detail returns 404 for a missing appointment", async () => {
  const plan = await insertTreatmentPlan();
  const response = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments/999999999`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Treatment Appointment not found");
});

test("patient cannot create update or delete treatment appointments", async () => {
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const token = `Bearer ${tokenFor(users.patient)}`;
  const createResponse = await request(app)
    .post(`/api/patient/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", token)
    .send({ appointment_date: "2026-10-15 10:30:00", purpose: "Visit" });
  const updateResponse = await request(app)
    .patch(`/api/patient/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", token)
    .send({ purpose: "Changed" });
  const deleteResponse = await request(app)
    .delete(`/api/patient/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", token);

  assert.equal(createResponse.status, 404);
  assert.equal(updateResponse.status, 404);
  assert.equal(deleteResponse.status, 404);
  assert.ok(await db("treatment_appointments").where({ id: appointment.id }).first());
});

test("patient registration creates one active patient account with a hashed password", async () => {
  const payload = patientRegistration();
  const response = await request(app)
    .post("/api/auth/register/patient")
    .send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.role, "PATIENT");
  assert.equal(response.body.data.user.account_status, "ACTIVE");
  assert.equal(response.body.data.patient.date_of_birth, "1995-04-12");
  assert.equal(response.body.data.patient.national_id, payload.national_id);
  assert.equal("password_hash" in response.body.data.user, false);

  const user = await db("users").where({ email: payload.email }).first();
  const patient = await db("patients").where({ user_id: user.id }).first();
  const joinRequest = await db("join_requests").where({ user_id: user.id }).first();

  assert.ok(user);
  assert.ok(patient);
  assert.equal(patient.national_id, payload.national_id);
  assert.equal(joinRequest, undefined);
  assert.notEqual(user.password_hash, payload.password);
  assert.equal(await bcrypt.compare(payload.password, user.password_hash), true);
});

test("patient registration rejects missing and malformed national IDs", async () => {
  const cases = [
    undefined,
    "12345678",
    "1234567890",
    "12345A789",
    "023456789",
  ];

  for (const nationalId of cases) {
    const response = await request(app)
      .post("/api/auth/register/patient")
      .send(patientRegistration({ national_id: nationalId }));

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.equal(
      response.body.errors.national_id,
      "national_id must be exactly 9 digits and must not start with 0",
    );
  }

  assert.equal(
    Number((await db("users").where({ email: "sprint5.patient@test.local" }).count("id as count"))[0].count),
    0,
  );
});

test("patient registration enforces the approved phone date and password rules", async () => {
  const cases = [
    [
      patientRegistration({ phone: "0581234567" }),
      "phone",
    ],
    [
      patientRegistration({ date_of_birth: "2025-02-29" }),
      "date_of_birth",
    ],
    [
      patientRegistration({ password: "lowercase1", password_confirmation: "lowercase1" }),
      "password",
    ],
    [
      patientRegistration({ password_confirmation: "Different123" }),
      "password_confirmation",
    ],
  ];

  for (const [payload, field] of cases) {
    const response = await request(app)
      .post("/api/auth/register/patient")
      .send(payload);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.ok(response.body.errors[field]);
  }

  assert.equal(
    Number((await db("users").where("email", "like", "sprint5.patient%@test.local").count("id as count"))[0].count),
    0,
  );
});

test("patient registration rejects a duplicate email without creating a second profile", async () => {
  const payload = patientRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/patient").send(payload)).status,
    201,
  );

  const response = await request(app)
    .post("/api/auth/register/patient")
    .send(payload);

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "An account with this email already exists");
  assert.equal(
    Number((await db("users").where({ email: payload.email }).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("patients").join("users", "users.id", "patients.user_id").where("users.email", payload.email).count("patients.id as count"))[0].count),
    1,
  );
});

test("patient registration rejects a duplicate national ID without partial records", async () => {
  const original = patientRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/patient").send(original)).status,
    201,
  );

  const duplicate = patientRegistration({
    email: "sprint5.patient2@test.local",
  });
  const response = await request(app)
    .post("/api/auth/register/patient")
    .send(duplicate);

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "A patient with this national ID already exists");
  assert.equal(
    await db("users").where({ email: duplicate.email }).first(),
    undefined,
  );
  assert.equal(
    Number((await db("patients").where({ national_id: original.national_id }).count("id as count"))[0].count),
    1,
  );
});

test("patient registration rolls back the user when profile creation fails", async () => {
  const payload = patientRegistration({
    email: "rollback.patient@test.local",
    gender: "INVALID",
  });

  await assert.rejects(registerPatient(payload));
  assert.equal(await db("users").where({ email: payload.email }).first(), undefined);
  assert.equal(
    Number((await db("patients").join("users", "users.id", "patients.user_id").where("users.email", payload.email).count("patients.id as count"))[0].count),
    0,
  );
});

test("doctor registration atomically creates an inactive account profile and pending request", async () => {
  const payload = doctorRegistration();
  const response = await request(app)
    .post("/api/auth/register/doctor")
    .send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, "DOCTOR");
  assert.equal(response.body.data.user.account_status, "INACTIVE");
  assert.equal(response.body.data.join_request.request_type, "DOCTOR");
  assert.equal(response.body.data.join_request.status, "PENDING");

  const user = await db("users").where({ email: payload.email }).first();
  assert.ok(await db("doctors").where({ user_id: user.id }).first());
  assert.ok(
    await db("join_requests")
      .where({ user_id: user.id, request_type: "DOCTOR", status: "PENDING" })
      .first(),
  );
});

test("doctor registration rejects duplicate email and license conflicts", async () => {
  const payload = doctorRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/doctor").send(payload)).status,
    201,
  );

  const duplicateEmail = await request(app)
    .post("/api/auth/register/doctor")
    .send(doctorRegistration({ license_number: "SPRINT5-DOC-002" }));
  const duplicateLicense = await request(app)
    .post("/api/auth/register/doctor")
    .send(doctorRegistration({ email: "sprint5.doctor2@test.local" }));

  assert.equal(duplicateEmail.status, 409);
  assert.equal(duplicateLicense.status, 409);
  assert.equal(
    Number((await db("users").whereIn("email", [payload.email, "sprint5.doctor2@test.local"]).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("doctors").where({ license_number: payload.license_number }).count("id as count"))[0].count),
    1,
  );
});

test("concurrent doctor registration leaves one complete registration and no partial rows", async () => {
  const payload = doctorRegistration();
  const responses = await Promise.all([
    request(app).post("/api/auth/register/doctor").send(payload),
    request(app).post("/api/auth/register/doctor").send(payload),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409],
  );

  const registeredUsers = await db("users").where({ email: payload.email });
  assert.equal(registeredUsers.length, 1);
  assert.equal(
    Number((await db("doctors").where({ user_id: registeredUsers[0].id }).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("join_requests").where({ user_id: registeredUsers[0].id }).count("id as count"))[0].count),
    1,
  );
});

test("doctor registration rolls back the user when profile creation fails", async () => {
  const payload = doctorRegistration({
    email: "rollback.doctor@test.local",
    specialization: null,
    license_number: "ROLLBACK-DOC-001",
  });

  await assert.rejects(registerDoctor(payload));
  assert.equal(await db("users").where({ email: payload.email }).first(), undefined);
  assert.equal(
    Number((await db("doctors").where({ license_number: payload.license_number }).count("id as count"))[0].count),
    0,
  );
});

test("NGO registration atomically creates an inactive account profile and pending request", async () => {
  const payload = ngoRegistration();
  const response = await request(app)
    .post("/api/auth/register/ngo")
    .send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, "NGO");
  assert.equal(response.body.data.user.account_status, "INACTIVE");
  assert.equal(response.body.data.ngo.contact_phone, payload.phone);
  assert.equal(response.body.data.join_request.request_type, "NGO");
  assert.equal(response.body.data.join_request.status, "PENDING");

  const user = await db("users").where({ email: payload.email }).first();
  assert.ok(await db("ngos").where({ user_id: user.id }).first());
  assert.ok(await db("join_requests").where({ user_id: user.id, status: "PENDING" }).first());
});

test("NGO registration rejects duplicate email and registration number conflicts", async () => {
  const payload = ngoRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/ngo").send(payload)).status,
    201,
  );

  const duplicateEmail = await request(app)
    .post("/api/auth/register/ngo")
    .send(ngoRegistration({ registration_number: "SPRINT5-NGO-002" }));
  const duplicateRegistration = await request(app)
    .post("/api/auth/register/ngo")
    .send(ngoRegistration({ email: "sprint5.ngo2@test.local" }));

  assert.equal(duplicateEmail.status, 409);
  assert.equal(duplicateRegistration.status, 409);
  assert.equal(
    Number((await db("users").whereIn("email", [payload.email, "sprint5.ngo2@test.local"]).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("ngos").where({ registration_number: payload.registration_number }).count("id as count"))[0].count),
    1,
  );
});

test("NGO registration rolls back the user when profile creation fails", async () => {
  const payload = ngoRegistration({
    email: "rollback.ngo@test.local",
    organization_name: null,
    registration_number: "ROLLBACK-NGO-001",
  });

  await assert.rejects(registerNgo(payload));
  assert.equal(await db("users").where({ email: payload.email }).first(), undefined);
  assert.equal(
    Number((await db("ngos").where({ registration_number: payload.registration_number }).count("id as count"))[0].count),
    0,
  );
});

test("login issues a role-bearing JWT and grants access to a protected route", async () => {
  const payload = patientRegistration();
  await request(app).post("/api/auth/register/patient").send(payload);

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: `  ${payload.email}  `, password: payload.password });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.role, "PATIENT");
  assert.equal("password_hash" in response.body.data.user, false);

  const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
  assert.equal(decoded.role, "PATIENT");
  assert.equal(String(decoded.user_id), String(response.body.data.user.id));
  assert.equal(typeof decoded.exp, "number");

  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${response.body.data.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, payload.email);
});

test("login safely rejects a wrong password and an unknown account", async () => {
  const payload = patientRegistration();
  await request(app).post("/api/auth/register/patient").send(payload);

  for (const credentials of [
    { email: payload.email, password: "Wrong123" },
    { email: "missing@test.local", password: "Wrong123" },
  ]) {
    const response = await request(app).post("/api/auth/login").send(credentials);
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Invalid email or password");
  }
});

test("login rejects inactive unapproved accounts", async () => {
  const payload = doctorRegistration();
  await request(app).post("/api/auth/register/doctor").send(payload);

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Account is not active");
});

test("protected routes reject malformed invalid and expired JWTs", async () => {
  const expiredToken = jwt.sign(
    { user_id: users.patient.id, role: "PATIENT" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: -1 },
  );

  for (const authorization of [
    "Bearer not-a-jwt",
    `Bearer ${expiredToken}`,
    "Basic credentials",
  ]) {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", authorization);
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Authentication required");
  }
});

test("join request review endpoints enforce authentication and ADMIN authorization", async () => {
  const unauthenticated = await request(app).get("/api/admin/join-requests");
  const forbidden = await request(app)
    .get("/api/admin/join-requests")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(unauthenticated.status, 401);
  assert.equal(forbidden.status, 403);
});

test("admin approval updates request and user states with fresh timestamps", async () => {
  const oldTimestamp = "2020-01-01 00:00:00";
  const doctor = await createUser({
    fullName: "Pending Doctor",
    email: "pending.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });
  await db("doctors").insert({
    user_id: doctor.id,
    specialization: "General Medicine",
    license_number: "PENDING-DOC-001",
  });
  const [requestId] = await db("join_requests").insert({
    user_id: doctor.id,
    request_type: "DOCTOR",
    created_at: oldTimestamp,
    updated_at: oldTimestamp,
  });
  await db("users").where({ id: doctor.id }).update({ updated_at: oldTimestamp });

  const response = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.join_request.status, "APPROVED");
  assert.equal(response.body.data.join_request.user.account_status, "ACTIVE");
  assert.equal(String(response.body.data.join_request.reviewed_by_admin_id), String(users.admin.id));
  assert.ok(response.body.data.join_request.reviewed_at);

  const reviewed = await db("join_requests").where({ id: requestId }).first();
  const activated = await db("users").where({ id: doctor.id }).first();
  assert.ok(new Date(reviewed.updated_at).getTime() > new Date(oldTimestamp).getTime());
  assert.ok(new Date(activated.updated_at).getTime() > new Date(oldTimestamp).getTime());
});

test("admin rejection updates request state and timestamp while keeping the account inactive", async () => {
  const oldTimestamp = "2020-01-01 00:00:00";
  const ngo = await createUser({
    fullName: "Pending NGO",
    email: "pending.ngo@test.local",
    role: "NGO",
    accountStatus: "INACTIVE",
  });
  await db("ngos").insert({
    user_id: ngo.id,
    organization_name: "Pending NGO",
    registration_number: "PENDING-NGO-001",
  });
  const [requestId] = await db("join_requests").insert({
    user_id: ngo.id,
    request_type: "NGO",
    created_at: oldTimestamp,
    updated_at: oldTimestamp,
  });

  const response = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/reject`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ rejection_reason: "Verification documents are incomplete" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.join_request.status, "REJECTED");
  assert.equal(response.body.data.join_request.user.account_status, "INACTIVE");
  assert.equal(
    response.body.data.join_request.rejection_reason,
    "Verification documents are incomplete",
  );

  const reviewed = await db("join_requests").where({ id: requestId }).first();
  assert.ok(new Date(reviewed.updated_at).getTime() > new Date(oldTimestamp).getTime());
});

test("join request review rejects missing and already reviewed requests", async () => {
  const missing = await request(app)
    .patch("/api/admin/join-requests/999999999/approve")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});
  assert.equal(missing.status, 404);

  const doctor = await createUser({
    fullName: "Reviewed Doctor",
    email: "reviewed.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });
  await db("doctors").insert({
    user_id: doctor.id,
    specialization: "General Medicine",
    license_number: "REVIEWED-DOC-001",
  });
  const [requestId] = await db("join_requests").insert({
    user_id: doctor.id,
    request_type: "DOCTOR",
  });

  const first = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});
  const repeated = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});

  assert.equal(first.status, 200);
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.message, "Join request has already been reviewed");
});

async function insertDoctorEmergencyAlert(overrides = {}) {
  const [id] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    assigned_doctor_id: users.doctorProfile.id,
    assigned_by_admin_id: users.admin.id,
    priority: "HIGH",
    status: "ASSIGNED",
    assigned_at: db.fn.now(),
    ...overrides,
  });

  return db("emergency_alerts").where({ id }).first();
}

test("public visitor can create an Emergency Alert", async () => {
  const response = await request(app).post("/api/emergency-alerts").send({
    phone: "0591234567",
    location: "Gaza",
    description: "Urgent medical assistance needed",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  const alert = response.body.data.emergency_alert;

  assert.equal(alert.patient_id, null);
  assert.equal(alert.phone, "0591234567");
  assert.equal(alert.location, "Gaza");
  assert.equal(alert.description, "Urgent medical assistance needed");
  assert.equal(alert.priority, "HIGH");
  assert.equal(alert.status, "PENDING_ASSIGNMENT");
});

test("public Emergency Alert requires phone", async () => {
  const response = await request(app).post("/api/emergency-alerts").send({
    location: "Gaza",
    description: "Emergency",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.phone, "phone is required");
});

test("public Emergency Alert rejects client-controlled priority and status", async () => {
  const response = await request(app).post("/api/emergency-alerts").send({
    phone: "0591234567",
    priority: "CRITICAL",
    status: "RESOLVED",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.priority, "priority is not allowed");
  assert.equal(response.body.errors.status, "status is not allowed");
});

test("authenticated Patient can create an Emergency Alert linked to own profile", async () => {
  const response = await request(app)
    .post("/api/patient/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      phone: "0593333333",
      location: "Gaza",
      description: "Patient emergency",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  const alert = response.body.data.emergency_alert;

  assert.equal(alert.patient_id, users.patientProfile.id);
  assert.equal(alert.phone, "0593333333");
  assert.equal(alert.priority, "HIGH");
  assert.equal(alert.status, "PENDING_ASSIGNMENT");
});

test("Patient Emergency Alert does not accept patient_id from request", async () => {
  const response = await request(app)
    .post("/api/patient/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      phone: "0593333333",
      patient_id: 999999,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.patient_id, "patient_id is not allowed");
});

test("Patient can list only own Emergency Alerts", async () => {
  const otherPatientUser = await createUser({
    fullName: "Other Emergency Patient",
    email: "other.emergency.patient@test.local",
    role: "PATIENT",
  });

  const [otherPatientId] = await db("patients").insert({
    user_id: otherPatientUser.id,
    national_id: "623456789",
    date_of_birth: "1999-05-10",
    gender: "FEMALE",
    address: "Gaza",
  });

  await db("emergency_alerts").insert([
    {
      patient_id: users.patientProfile.id,
      phone: "0591111111",
      description: "Own alert",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    },
    {
      patient_id: otherPatientId,
      phone: "0592222222",
      description: "Other patient alert",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    },
    {
      patient_id: null,
      phone: "0593333333",
      description: "Visitor alert",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    },
  ]);

  const response = await request(app)
    .get("/api/patient/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emergency_alerts.length, 1);
  assert.equal(
    response.body.data.emergency_alerts[0].patient_id,
    users.patientProfile.id,
  );
});

test("Patient can view own Emergency Alert", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    description: "Own emergency",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .get(`/api/patient/emergency-alerts/${alertId}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emergency_alert.id, alertId);
});

test("Patient cannot view another Patient Emergency Alert", async () => {
  const otherPatientUser = await createUser({
    fullName: "Other Alert Owner",
    email: "other.alert.owner@test.local",
    role: "PATIENT",
  });

  const [otherPatientId] = await db("patients").insert({
    user_id: otherPatientUser.id,
    national_id: "723456789",
    date_of_birth: "1998-08-12",
    gender: "MALE",
    address: "Gaza",
  });

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: otherPatientId,
    phone: "0592222222",
    description: "Private emergency",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .get(`/api/patient/emergency-alerts/${alertId}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Emergency Alert not found");
});

test("Patient can cancel own Emergency Alert while pending assignment", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    description: "Cancel this alert",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/patient/emergency-alerts/${alertId}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emergency_alert.status, "CANCELLED");

  const storedAlert = await db("emergency_alerts")
    .where({ id: alertId })
    .first();

  assert.equal(storedAlert.status, "CANCELLED");
});

test("Patient cannot cancel Emergency Alert after assignment", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    description: "Already assigned",
    priority: "HIGH",
    status: "ASSIGNED",
  });

  const response = await request(app)
    .patch(`/api/patient/emergency-alerts/${alertId}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.message,
    "Only Emergency Alerts pending assignment can be cancelled",
  );

  const storedAlert = await db("emergency_alerts")
    .where({ id: alertId })
    .first();

  assert.equal(storedAlert.status, "ASSIGNED");
});

test("Patient cannot cancel another Patient Emergency Alert", async () => {
  const otherPatientUser = await createUser({
    fullName: "Other Cancellation Patient",
    email: "other.cancellation.patient@test.local",
    role: "PATIENT",
  });

  const [otherPatientId] = await db("patients").insert({
    user_id: otherPatientUser.id,
    national_id: "823456789",
    date_of_birth: "1997-03-20",
    gender: "FEMALE",
    address: "Gaza",
  });

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: otherPatientId,
    phone: "0592222222",
    description: "Other patient emergency",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/patient/emergency-alerts/${alertId}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Emergency Alert not found");

  const storedAlert = await db("emergency_alerts")
    .where({ id: alertId })
    .first();

  assert.equal(storedAlert.status, "PENDING_ASSIGNMENT");
});

test("Patient Emergency Alert endpoints require Patient authentication", async () => {
  const response = await request(app).get("/api/patient/emergency-alerts");

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});

test("Emergency Alert creation accepts omitted optional fields", async () => {
  const response = await request(app).post("/api/emergency-alerts").send({
    phone: "0591234567",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.emergency_alert.location, null);
  assert.equal(response.body.data.emergency_alert.description, null);
});

test("Emergency Alert creation accepts null optional fields", async () => {
  const response = await request(app).post("/api/emergency-alerts").send({
    phone: "0591234567",
    location: null,
    description: null,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.emergency_alert.location, null);
  assert.equal(response.body.data.emergency_alert.description, null);
});

test("Patient Emergency Alert detail rejects invalid alertId", async () => {
  const response = await request(app)
    .get("/api/patient/emergency-alerts/0")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
});

test("Patient cannot cancel an Emergency Alert twice", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const firstResponse = await request(app)
    .patch(`/api/patient/emergency-alerts/${alertId}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(firstResponse.status, 200);

  const secondResponse = await request(app)
    .patch(`/api/patient/emergency-alerts/${alertId}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(secondResponse.status, 400);
});

test("Emergency Alert cancellation rejects request fields", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/patient/emergency-alerts/${alertId}/cancel`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      status: "CANCELLED",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.status, "status is not allowed");
});

test("non-Patient role cannot access Patient Emergency Alert endpoints", async () => {
  const response = await request(app)
    .get("/api/patient/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 403);
});

test("Patient Emergency Alerts are listed newest first", async () => {
  await db("emergency_alerts").insert([
    {
      patient_id: users.patientProfile.id,
      phone: "0591111111",
      description: "Older",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
      sent_at: "2026-09-23 10:00:00",
    },
    {
      patient_id: users.patientProfile.id,
      phone: "0592222222",
      description: "Newer",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
      sent_at: "2026-09-23 11:00:00",
    },
  ]);

  const response = await request(app)
    .get("/api/patient/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.emergency_alerts[0].description, "Newer");
  assert.equal(response.body.data.emergency_alerts[1].description, "Older");
});

test("Admin can list all Emergency Alerts", async () => {
  await db("emergency_alerts").insert([
    {
      patient_id: users.patientProfile.id,
      phone: "0591111111",
      description: "Patient alert",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    },
    {
      patient_id: null,
      phone: "0592222222",
      description: "Visitor alert",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    },
  ]);

  const response = await request(app)
    .get("/api/admin/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emergency_alerts.length, 2);
});

test("Admin can view an Emergency Alert by ID", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    description: "Admin detail alert",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .get(`/api/admin/emergency-alerts/${alertId}`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emergency_alert.id, alertId);
});

test("Admin Emergency Alert detail returns 404 for missing alert", async () => {
  const response = await request(app)
    .get("/api/admin/emergency-alerts/999999999")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 404);
});

test("non-Admin role cannot access Admin Emergency Alert endpoints", async () => {
  const response = await request(app)
    .get("/api/admin/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 403);
});

test("Admin can assign pending Emergency Alert to active General Medicine Doctor", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const alert = response.body.data.emergency_alert;

  assert.equal(alert.status, "ASSIGNED");
  assert.equal(alert.assigned_doctor_id, users.doctorProfile.id);
  assert.equal(alert.assigned_by_admin_id, users.admin.id);
  assert.ok(alert.assigned_at);
});

test("Admin can assign pending Emergency Alert to active Emergency Medicine Doctor", async () => {
  const doctorUser = await createUser({
    fullName: "Emergency Medicine Doctor",
    email: "emergency.medicine@test.local",
    role: "DOCTOR",
    accountStatus: "ACTIVE",
  });

  const [doctorId] = await db("doctors").insert({
    user_id: doctorUser.id,
    specialization: "Emergency Medicine",
    license_number: "EMERGENCY-DOC-001",
  });

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: null,
    phone: "0592222222",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: doctorId,
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.emergency_alert.status, "ASSIGNED");
  assert.equal(response.body.data.emergency_alert.assigned_doctor_id, doctorId);
});

test("Admin cannot assign Emergency Alert to Doctor with ineligible specialization", async () => {
  const doctorUser = await createUser({
    fullName: "Specialist Doctor",
    email: "specialist.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "ACTIVE",
  });

  const [doctorId] = await db("doctors").insert({
    user_id: doctorUser.id,
    specialization: "Cardiology",
    license_number: "CARDIOLOGY-DOC-001",
  });

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: doctorId,
    });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    "Doctor specialization is not eligible for Emergency Alert assignment",
  );
});

test("Admin cannot assign Emergency Alert to inactive Doctor", async () => {
  const doctorUser = await createUser({
    fullName: "Inactive Emergency Doctor",
    email: "inactive.emergency@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });

  const [doctorId] = await db("doctors").insert({
    user_id: doctorUser.id,
    specialization: "Emergency Medicine",
    license_number: "INACTIVE-EMERGENCY-001",
  });

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: doctorId,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Doctor account is not active");
});

test("Admin cannot assign Emergency Alert to nonexistent Doctor", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: 999999999,
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Doctor not found");
});

test("Admin cannot assign nonexistent Emergency Alert", async () => {
  const response = await request(app)
    .patch("/api/admin/emergency-alerts/999999999/assign")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Emergency Alert not found");
});

test("Admin cannot assign Emergency Alert that is not pending assignment", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "CANCELLED",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
    });

  assert.equal(response.status, 409);
  assert.equal(
    response.body.message,
    "Emergency Alert is not pending assignment",
  );
});

test("Admin cannot assign an Emergency Alert twice", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const firstResponse = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
    });

  assert.equal(firstResponse.status, 200);

  const secondResponse = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
    });

  assert.equal(secondResponse.status, 409);
});

test("Emergency Alert assignment requires doctor_id", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.doctor_id, "doctor_id is required");
});

test("Emergency Alert assignment rejects invalid doctor_id", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: 0,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
});

test("Emergency Alert assignment rejects additional request fields", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: users.doctorProfile.id,
      status: "RESOLVED",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
  assert.equal(response.body.errors.status, "status is not allowed");
});

test("Emergency Alert assignment rejects unsafe numeric doctor_id", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: Number.MAX_SAFE_INTEGER + 1,
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
});

test("Emergency Alert assignment rejects doctor_id above unsigned BIGINT maximum", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({
      doctor_id: "18446744073709551616",
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Validation failed");
});

test("Concurrent Emergency Alert assignments allow only one assignment", async () => {
  const secondDoctorUser = await createUser({
    fullName: "Concurrent Emergency Doctor",
    email: "concurrent.emergency@test.local",
    role: "DOCTOR",
    accountStatus: "ACTIVE",
  });

  const [secondDoctorId] = await db("doctors").insert({
    user_id: secondDoctorUser.id,
    specialization: "Emergency Medicine",
    license_number: "CONCURRENT-EMERGENCY-001",
  });

  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const [firstResponse, secondResponse] = await Promise.all([
    request(app)
      .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({
        doctor_id: users.doctorProfile.id,
      }),

    request(app)
      .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({
        doctor_id: secondDoctorId,
      }),
  ]);

  const statuses = [firstResponse.status, secondResponse.status].sort(
    (a, b) => a - b,
  );

  assert.deepEqual(statuses, [200, 409]);

  const alert = await db("emergency_alerts").where({ id: alertId }).first();

  assert.equal(alert.status, "ASSIGNED");
  assert.ok(
    [users.doctorProfile.id, secondDoctorId].includes(
      Number(alert.assigned_doctor_id),
    ),
  );
  assert.equal(Number(alert.assigned_by_admin_id), users.admin.id);
  assert.ok(alert.assigned_at);
});

test("assigned Doctor starts Emergency Alert progress and persists response timestamps", async () => {
  const alert = await insertDoctorEmergencyAlert({
    patient_id: null,
    updated_at: "2026-01-01 00:00:00",
  });

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "IN_PROGRESS" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emergency_alert.status, "IN_PROGRESS");
  assert.ok(response.body.data.emergency_alert.responded_at);
  assert.equal(response.body.data.emergency_alert.resolved_at, null);

  const stored = await db("emergency_alerts").where({ id: alert.id }).first();
  assert.equal(stored.status, "IN_PROGRESS");
  assert.ok(stored.responded_at);
  assert.equal(stored.resolved_at, null);
  assert.ok(stored.updated_at.getTime() > alert.updated_at.getTime());
});

test("assigned Doctor resolves an in-progress Emergency Alert without overwriting responded_at", async () => {
  const alert = await insertDoctorEmergencyAlert({
    status: "IN_PROGRESS",
    responded_at: "2026-09-25 10:00:00",
    updated_at: "2026-01-01 00:00:00",
  });

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "RESOLVED" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.emergency_alert.status, "RESOLVED");

  const stored = await db("emergency_alerts").where({ id: alert.id }).first();
  assert.equal(stored.status, "RESOLVED");
  assert.equal(stored.responded_at.getTime(), alert.responded_at.getTime());
  assert.ok(stored.resolved_at);
  assert.ok(stored.updated_at.getTime() > alert.updated_at.getTime());
});

test("Doctor Emergency Alert status endpoint hides alerts assigned to another Doctor", async () => {
  const otherDoctor = await createSecondDoctor();
  const alert = await insertDoctorEmergencyAlert();

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(otherDoctor.user)}`)
    .send({ status: "IN_PROGRESS" });

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Emergency Alert not found");

  const stored = await db("emergency_alerts").where({ id: alert.id }).first();
  assert.equal(stored.status, "ASSIGNED");
  assert.equal(stored.responded_at, null);
});

test("Doctor Emergency Alert status endpoint enforces authentication and DOCTOR role", async () => {
  const alert = await insertDoctorEmergencyAlert();
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;

  const responses = await Promise.all([
    request(app).patch(path).send({ status: "IN_PROGRESS" }),
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
      .send({ status: "IN_PROGRESS" }),
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
      .send({ status: "IN_PROGRESS" }),
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ status: "IN_PROGRESS" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    [401, 403, 403, 403],
  );
});

test("Doctor Emergency Alert status endpoint validates alertId as BIGINT UNSIGNED", async () => {
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  for (const alertId of [
    "not-an-id",
    "0",
    "-1",
    "18446744073709551616",
  ]) {
    const response = await request(app)
      .patch(`/api/doctor/emergency-alerts/${alertId}/status`)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Validation failed");
  }
});

test("Doctor Emergency Alert status endpoint accepts exactly one supported status field", async () => {
  const alert = await insertDoctorEmergencyAlert();
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const responses = await Promise.all([
    request(app).patch(path).set("Authorization", authorization).send({}),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "ASSIGNED" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS", doctor_id: users.doctorProfile.id }),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Validation failed");
  }
});

test("Doctor Emergency Alert status endpoint returns 404 for a missing alert", async () => {
  const response = await request(app)
    .patch("/api/doctor/emergency-alerts/999999999/status")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "IN_PROGRESS" });

  assert.equal(response.status, 404);
  assert.equal(response.body.message, "Emergency Alert not found");
});

test("Doctor Emergency Alert workflow rejects unsupported transitions without mutation", async () => {
  for (const [currentStatus, nextStatus] of [
    ["ASSIGNED", "RESOLVED"],
    ["IN_PROGRESS", "IN_PROGRESS"],
    ["RESOLVED", "RESOLVED"],
    ["CANCELLED", "IN_PROGRESS"],
  ]) {
    const alert = await insertDoctorEmergencyAlert({
      status: currentStatus,
      responded_at:
        currentStatus === "IN_PROGRESS" || currentStatus === "RESOLVED"
          ? "2026-09-25 10:00:00"
          : null,
      resolved_at:
        currentStatus === "RESOLVED" ? "2026-09-25 11:00:00" : null,
    });

    const response = await request(app)
      .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ status: nextStatus });

    assert.equal(response.status, 409);

    const stored = await db("emergency_alerts")
      .where({ id: alert.id })
      .first();
    assert.equal(stored.status, currentStatus);
  }
});

test("concurrent Doctor Emergency Alert transitions allow only one stale-state winner", async () => {
  const alert = await insertDoctorEmergencyAlert();
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );

  const stored = await db("emergency_alerts").where({ id: alert.id }).first();
  assert.equal(stored.status, "IN_PROGRESS");
  assert.ok(stored.responded_at);
  assert.equal(stored.resolved_at, null);
});

// ==============================
// Assistance Requests
// ==============================

async function insertAssistanceRequest(overrides = {}) {
  const [id] = await db("assistance_requests").insert({
    patient_id: users.patientProfile.id,
    doctor_id: users.doctorProfile.id,
    request_type: "Medical supplies",
    description: "Patient requires medical supplies",
    ...overrides,
  });

  return db("assistance_requests").where({ id }).first();
}

async function createSecondPatientForAssistanceRequests() {
  const patientUser = await createUser({
    fullName: "Second Assistance Patient",
    email: "second.assistance.patient@test.local",
    role: "PATIENT",
    phone: "0593333333",
  });

  const [patientId] = await db("patients").insert({
    user_id: patientUser.id,
    national_id: "923456781",
    date_of_birth: "1998-06-20",
    gender: "FEMALE",
    address: "Gaza",
  });

  const patientProfile = await db("patients").where({ id: patientId }).first();

  return { patientUser, patientProfile };
}

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

async function getPrimaryNgoProfile() {
  return db("ngos").where({ user_id: users.ngo.id }).first();
}

async function createAssistanceNgo({
  email,
  registrationNumber,
  role = "NGO",
  accountStatus = "ACTIVE",
}) {
  const user = await createUser({
    fullName: `Assistance ${registrationNumber}`,
    email,
    role,
    accountStatus,
  });
  const [id] = await db("ngos").insert({
    user_id: user.id,
    organization_name: `Organization ${registrationNumber}`,
    registration_number: registrationNumber,
  });

  return {
    user,
    profile: await db("ngos").where({ id }).first(),
  };
}

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

async function insertResourceAllocation(requestId, overrides = {}) {
  const [id] = await db("resource_allocations").insert({
    assistance_request_id: requestId,
    resource_name: "Medical supplies",
    quantity: 2,
    ...overrides,
  });

  return db("resource_allocations").where({ id }).first();
}

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

// ==============================
// Patient-Doctor Messaging
// ==============================

async function insertMessagingAssignment(overrides = {}) {
  const [id] = await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
    assignment_reason: "Messaging test assignment",
    ...overrides,
  });

  return db("doctor_patient_assignments").where({ id }).first();
}

async function createMessagingPatient(suffix) {
  const user = await createUser({
    fullName: `Messaging Patient ${suffix}`,
    email: `messaging.patient.${suffix}@test.local`,
    role: "PATIENT",
  });
  const [id] = await db("patients").insert({
    user_id: user.id,
    national_id: `8${String(user.id).padStart(8, "0")}`.slice(-9),
    date_of_birth: "1998-02-03",
    gender: "FEMALE",
  });

  return { user, profile: await db("patients").where({ id }).first() };
}

async function createMessagingDoctor(suffix) {
  const user = await createUser({
    fullName: `Messaging Doctor ${suffix}`,
    email: `messaging.doctor.${suffix}@test.local`,
    role: "DOCTOR",
  });
  const [id] = await db("doctors").insert({
    user_id: user.id,
    specialization: "General Medicine",
    license_number: `MSG-DOCTOR-${suffix}`,
  });

  return { user, profile: await db("doctors").where({ id }).first() };
}

async function insertMessage(overrides = {}) {
  const [id] = await db("messages").insert({
    sender_id: users.patient.id,
    receiver_id: users.doctor.id,
    message_text: "Messaging fixture",
    ...overrides,
  });

  return db("messages").where({ id }).first();
}

test("Patient sends a message to an actively assigned Doctor with server-derived sender fields", async () => {
  await insertMessagingAssignment();

  const response = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      receiver_id: users.doctor.id,
      message_text: "  I need advice about my medication.  ",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.message.sender_id, users.patient.id);
  assert.equal(response.body.data.message.receiver_id, users.doctor.id);
  assert.equal(
    response.body.data.message.message_text,
    "I need advice about my medication.",
  );
  assert.equal(response.body.data.message.is_read, 0);
  assert.equal(response.body.data.message.read_at, null);
  assert.ok(response.body.data.message.sent_at);

  const stored = await db("messages")
    .where({ id: response.body.data.message.id })
    .first();
  assert.equal(stored.sender_id, users.patient.id);
  assert.equal(stored.receiver_id, users.doctor.id);
});

test("Doctor sends a message to an actively assigned Patient with authenticated identity", async () => {
  await insertMessagingAssignment();

  const response = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      receiver_id: users.patient.id,
      message_text: "Please continue the prescribed treatment.",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.message.sender_id, users.doctor.id);
  assert.equal(response.body.data.message.receiver_id, users.patient.id);
});

test("Messaging send requires the exact ACTIVE Doctor-Patient Assignment", async () => {
  const otherDoctor = await createMessagingDoctor("NO-PAIR");
  await insertMessagingAssignment();
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const wrongDoctor = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({
      receiver_id: otherDoctor.user.id,
      message_text: "This must be blocked",
    });

  await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    })
    .update({ status: "INACTIVE", ended_at: db.fn.now() });

  const inactive = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({
      receiver_id: users.doctor.id,
      message_text: "This must also be blocked",
    });

  assert.equal(wrongDoctor.status, 403);
  assert.equal(inactive.status, 403);
  assert.equal((await db("messages")).length, 0);
});

test("Doctor cannot message a Patient without their exact ACTIVE assignment", async () => {
  const otherPatient = await createMessagingPatient("NO-PAIR");
  await insertMessagingAssignment();

  const response = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      receiver_id: otherPatient.user.id,
      message_text: "This must be blocked",
    });

  assert.equal(response.status, 403);
  assert.equal((await db("messages")).length, 0);
});

test("Messaging rejects same-role recipients and nonexistent users", async () => {
  const otherPatient = await createMessagingPatient("SAME-ROLE");
  await insertMessagingAssignment();
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const sameRole = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({
      receiver_id: otherPatient.user.id,
      message_text: "Not allowed",
    });
  const missing = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({ receiver_id: "999999999", message_text: "Not found" });

  assert.equal(sameRole.status, 403);
  assert.equal(missing.status, 404);
});

test("Message creation validates exact fields IDs and TEXT capacity", async () => {
  await insertMessagingAssignment();
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const send = (body) =>
    request(app)
      .post("/api/messages")
      .set("Authorization", authorization)
      .send(body);

  const missingText = await send({ receiver_id: users.doctor.id });
  const empty = await send({
    receiver_id: users.doctor.id,
    message_text: "   ",
  });
  const oversized = await send({
    receiver_id: users.doctor.id,
    message_text: "م".repeat(32768),
  });
  const protectedField = await send({
    receiver_id: users.doctor.id,
    message_text: "Hello",
    sender_id: users.admin.id,
  });
  const unsafeNumber = await send({
    receiver_id: Number.MAX_SAFE_INTEGER + 1,
    message_text: "Hello",
  });
  const outOfRange = await send({
    receiver_id: "18446744073709551616",
    message_text: "Hello",
  });
  const exactBoundaryText = "a".repeat(65535);

  assert.equal(Buffer.byteLength(exactBoundaryText, "utf8"), 65535);

  const exactBoundary = await send({
    receiver_id: users.doctor.id,
    message_text: exactBoundaryText,
  });

  for (const response of [
    missingText,
    empty,
    oversized,
    protectedField,
    unsafeNumber,
    outOfRange,
  ]) {
    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Validation failed");
  }
  assert.equal(protectedField.body.errors.sender_id, "sender_id is not allowed");
  assert.equal(exactBoundary.status, 201);

  const storedBoundary = await db("messages")
    .where({ id: exactBoundary.body.data.message.id })
    .first();
  assert.equal(Buffer.byteLength(storedBoundary.message_text, "utf8"), 65535);
  assert.equal((await db("messages")).length, 1);
});

test("Patient and Doctor list only their own conversation summaries newest-first", async () => {
  const otherPatient = await createMessagingPatient("LIST");
  const otherDoctor = await createMessagingDoctor("LIST");
  const olderPrimary = await insertMessage({
    message_text: "Older conversation",
    sent_at: "2026-09-25 10:00:00",
  });
  await db("messages").insert({
    sender_id: otherPatient.user.id,
    receiver_id: otherDoctor.user.id,
    message_text: "Unrelated conversation",
    sent_at: "2026-09-26 11:00:00",
  });
  const latestPrimary = await insertMessage({
    sender_id: users.doctor.id,
    receiver_id: users.patient.id,
    message_text: "Latest primary conversation message",
    sent_at: "2026-09-26 12:00:00",
  });
  const latestOther = await insertMessage({
    sender_id: users.patient.id,
    receiver_id: otherDoctor.user.id,
    message_text: "Latest other conversation message",
    sent_at: "2026-09-26 12:00:00",
  });

  assert.ok(latestOther.id > latestPrimary.id);
  assert.ok(
    await db("messages").where({ id: olderPrimary.id }).first(),
  );
  assert.ok(
    await db("messages").where({ id: latestPrimary.id }).first(),
  );
  assert.ok(await db("messages").where({ id: latestOther.id }).first());

  const patientResponse = await request(app)
    .get("/api/messages/conversations")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(patientResponse.status, 200);
  assert.deepEqual(
    patientResponse.body.data.conversations.map((conversation) => ({
      participant_id: conversation.participant.id,
      latest_message_id: conversation.last_message.id,
    })),
    [
      {
        participant_id: otherDoctor.user.id,
        latest_message_id: latestOther.id,
      },
      {
        participant_id: users.doctor.id,
        latest_message_id: latestPrimary.id,
      },
    ],
  );
  assert.equal(
    new Set(
      patientResponse.body.data.conversations.map(
        (conversation) => String(conversation.participant.id),
      ),
    ).size,
    2,
  );

  const doctorResponse = await request(app)
    .get("/api/messages/conversations")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(doctorResponse.status, 200);
  assert.equal(doctorResponse.body.data.conversations.length, 1);
  assert.equal(
    doctorResponse.body.data.conversations[0].participant.id,
    users.patient.id,
  );
  assert.equal(
    doctorResponse.body.data.conversations[0].last_message.id,
    latestPrimary.id,
  );
  assert.deepEqual(
    Object.keys(patientResponse.body.data.conversations[0].participant).sort(),
    ["full_name", "id", "role"],
  );
});

test("Conversation history is participant-scoped and deterministically chronological", async () => {
  const first = await insertMessage({
    message_text: "First",
    sent_at: "2026-09-26 09:00:00",
  });
  const tiedFirst = await insertMessage({
    sender_id: users.doctor.id,
    receiver_id: users.patient.id,
    message_text: "Second",
    sent_at: "2026-09-26 10:00:00",
  });
  const tiedSecond = await insertMessage({
    message_text: "Third",
    sent_at: "2026-09-26 10:00:00",
  });

  for (const [currentUser, otherUser] of [
    [users.patient, users.doctor],
    [users.doctor, users.patient],
  ]) {
    const response = await request(app)
      .get(`/api/messages/conversations/${otherUser.id}`)
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.messages.map((message) => message.id),
      [first.id, tiedFirst.id, tiedSecond.id],
    );
  }
});

test("Unrelated Patients and Doctors cannot read another conversation", async () => {
  const otherPatient = await createMessagingPatient("HISTORY");
  const otherDoctor = await createMessagingDoctor("HISTORY");
  await insertMessage();

  const patientResponse = await request(app)
    .get(`/api/messages/conversations/${users.doctor.id}`)
    .set("Authorization", `Bearer ${tokenFor(otherPatient.user)}`);
  const doctorResponse = await request(app)
    .get(`/api/messages/conversations/${users.patient.id}`)
    .set("Authorization", `Bearer ${tokenFor(otherDoctor.user)}`);

  assert.equal(patientResponse.status, 403);
  assert.equal(doctorResponse.status, 403);
  assert.equal(patientResponse.body.message, "Conversation access forbidden");
});

test("Revoked assignment preserves history but blocks both directions of new messaging", async () => {
  const assignment = await insertMessagingAssignment();
  const firstSend = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({ receiver_id: users.doctor.id, message_text: "Historical message" });
  assert.equal(firstSend.status, 201);

  await db("doctor_patient_assignments")
    .where({ id: assignment.id })
    .update({ status: "INACTIVE", ended_at: db.fn.now() });

  const [patientHistory, doctorHistory, patientSend, doctorSend] =
    await Promise.all([
      request(app)
        .get(`/api/messages/conversations/${users.doctor.id}`)
        .set("Authorization", `Bearer ${tokenFor(users.patient)}`),
      request(app)
        .get(`/api/messages/conversations/${users.patient.id}`)
        .set("Authorization", `Bearer ${tokenFor(users.doctor)}`),
      request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
        .send({ receiver_id: users.doctor.id, message_text: "Blocked" }),
      request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
        .send({ receiver_id: users.patient.id, message_text: "Blocked" }),
    ]);

  assert.equal(patientHistory.status, 200);
  assert.equal(doctorHistory.status, 200);
  assert.equal(patientSend.status, 403);
  assert.equal(doctorSend.status, 403);
  assert.equal(patientHistory.body.data.messages.length, 1);
});

test("Message sending serializes safely with assignment deactivation", async () => {
  const assignment = await insertMessagingAssignment();
  const doctorModel = require("../src/models/doctorModel");
  const originalFindByIdForUpdate = doctorModel.findByIdForUpdate;
  let signalDoctorLockAttempt;
  const doctorLockAttempted = new Promise((resolve) => {
    signalDoctorLockAttempt = resolve;
  });
  const revocationTrx = await db.transaction();
  let transactionCompleted = false;
  let sendResponse;

  try {
    doctorModel.findByIdForUpdate = async (...args) => {
      signalDoctorLockAttempt();
      return originalFindByIdForUpdate(...args);
    };

    await revocationTrx("doctors")
      .where({ id: users.doctorProfile.id })
      .forUpdate()
      .first();
    await revocationTrx("patients")
      .where({ id: users.patientProfile.id })
      .forUpdate()
      .first();
    await revocationTrx("doctor_patient_assignments")
      .where({ id: assignment.id })
      .forUpdate()
      .first();
    await revocationTrx("doctor_patient_assignments")
      .where({ id: assignment.id })
      .update({
        status: "INACTIVE",
        ended_at: revocationTrx.fn.now(),
        updated_at: revocationTrx.fn.now(),
      });

    const sendPromise = request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
      .send({
        receiver_id: users.doctor.id,
        message_text: "Concurrent assignment state check",
      })
      .then((response) => response);

    await doctorLockAttempted;
    await revocationTrx.commit();
    transactionCompleted = true;
    sendResponse = await sendPromise;
  } finally {
    doctorModel.findByIdForUpdate = originalFindByIdForUpdate;
    if (!transactionCompleted) {
      await revocationTrx.rollback();
    }
  }

  assert.equal(sendResponse.status, 403);

  const storedAssignment = await db("doctor_patient_assignments")
    .where({ id: assignment.id })
    .first();
  const storedMessages = await db("messages").where({
    sender_id: users.patient.id,
    receiver_id: users.doctor.id,
  });

  assert.equal(storedAssignment.status, "INACTIVE");
  assert.equal(storedMessages.length, 0);
});

test("Only the receiver marks a message read and the operation is idempotent", async () => {
  const message = await insertMessage();
  const unrelatedPatient = await createMessagingPatient("READ");
  const path = `/api/messages/${message.id}/read`;

  const senderAttempt = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({});
  const unrelatedAttempt = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(unrelatedPatient.user)}`)
    .send({});
  const unchangedMessage = await db("messages")
    .where({ id: message.id })
    .first();

  assert.equal(senderAttempt.status, 403);
  assert.equal(unrelatedAttempt.status, 403);
  assert.equal(unchangedMessage.is_read, 0);
  assert.equal(unchangedMessage.read_at, null);

  const first = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});
  const second = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.message.is_read, 1);
  assert.ok(first.body.data.message.read_at);
  assert.equal(
    new Date(second.body.data.message.read_at).getTime(),
    new Date(first.body.data.message.read_at).getTime(),
  );
});

test("Message history and read routes validate scope identifiers and bodies", async () => {
  const message = await insertMessage();
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const invalidUser = await request(app)
    .get("/api/messages/conversations/not-an-id")
    .set("Authorization", authorization);
  const outOfRangeUser = await request(app)
    .get("/api/messages/conversations/18446744073709551616")
    .set("Authorization", authorization);
  const invalidMessage = await request(app)
    .patch("/api/messages/not-an-id/read")
    .set("Authorization", authorization)
    .send({});
  const unknownField = await request(app)
    .patch(`/api/messages/${message.id}/read`)
    .set("Authorization", authorization)
    .send({ is_read: true });
  const missing = await request(app)
    .patch("/api/messages/999999999/read")
    .set("Authorization", authorization)
    .send({});

  assert.equal(invalidUser.status, 400);
  assert.equal(outOfRangeUser.status, 400);
  assert.equal(invalidMessage.status, 400);
  assert.equal(unknownField.status, 400);
  assert.equal(missing.status, 404);
});

test("Messaging routes allow only authenticated Patient and Doctor accounts", async () => {
  const message = await insertMessage();

  for (const path of [
    ["post", "/api/messages"],
    ["get", "/api/messages/conversations"],
    ["get", `/api/messages/conversations/${users.doctor.id}`],
    ["patch", `/api/messages/${message.id}/read`],
  ]) {
    const unauthenticated = await request(app)[path[0]](path[1]);
    assert.equal(unauthenticated.status, 401);

    for (const wrongRole of [users.ngo, users.admin]) {
      const response = await request(app)
        [path[0]](path[1])
        .set("Authorization", `Bearer ${tokenFor(wrongRole)}`)
        .send(
          path[0] === "post"
            ? { receiver_id: users.doctor.id, message_text: "Blocked" }
            : path[0] === "patch"
              ? {}
              : undefined,
        );
      assert.equal(response.status, 403);
    }
  }
});

// ==============================
// Notifications
// ==============================

async function insertNotification(userId, overrides = {}) {
  const [id] = await db("notifications").insert({
    user_id: userId,
    title: "Test notification",
    message: "Test notification message",
    type: "TREATMENT_PLAN",
    is_read: false,
    reference_type: null,
    reference_id: null,
    read_at: null,
    ...overrides,
  });

  return db("notifications").where({ id }).first();
}

test("Notification APIs require authentication", async () => {
  for (const [method, path] of [
    ["get", "/api/notifications"],
    ["get", "/api/notifications/unread-count"],
    ["patch", "/api/notifications/1/read"],
    ["patch", "/api/notifications/read-all"],
  ]) {
    const response = await request(app)[method](path).send(
      method === "patch" ? {} : undefined,
    );

    assert.equal(response.status, 401);
  }
});

test("all authenticated roles list only their own Notifications", async () => {
  for (const currentUser of [
    users.patient,
    users.doctor,
    users.ngo,
    users.admin,
  ]) {
    await insertNotification(currentUser.id, {
      title: `${currentUser.role} notification`,
    });
  }

  for (const currentUser of [
    users.patient,
    users.doctor,
    users.ngo,
    users.admin,
  ]) {
    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.notifications.length, 1);
    assert.equal(
      response.body.data.notifications[0].user_id,
      currentUser.id,
    );
    assert.equal(
      response.body.data.notifications[0].title,
      `${currentUser.role} notification`,
    );

    const unreadResponse = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
    const readResponse = await request(app)
      .patch(
        `/api/notifications/${response.body.data.notifications[0].id}/read`,
      )
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
      .send({});

    assert.equal(unreadResponse.status, 200);
    assert.equal(unreadResponse.body.data.unread_count, 1);
    assert.equal(readResponse.status, 200);
  }
});

test("Notification list is deterministic newest-first and exposes safe schema fields", async () => {
  const older = await insertNotification(users.patient.id, {
    title: "Older",
    created_at: "2026-09-25 09:00:00",
  });
  const tiedFirst = await insertNotification(users.patient.id, {
    title: "Tied first",
    created_at: "2026-09-26 09:00:00",
  });
  const tiedSecond = await insertNotification(users.patient.id, {
    title: "Tied second",
    created_at: "2026-09-26 09:00:00",
  });

  const response = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.notifications.map((notification) => notification.id),
    [tiedSecond.id, tiedFirst.id, older.id],
  );
  assert.deepEqual(
    Object.keys(response.body.data.notifications[0]).sort(),
    [
      "created_at",
      "id",
      "is_read",
      "message",
      "read_at",
      "reference_id",
      "reference_type",
      "title",
      "type",
      "user_id",
    ],
  );
});

test("unread count is scoped to the authenticated user", async () => {
  await insertNotification(users.patient.id);
  await insertNotification(users.patient.id, {
    is_read: true,
    read_at: "2026-09-26 10:00:00",
  });
  await insertNotification(users.doctor.id);

  const patientResponse = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const doctorResponse = await request(app)
    .get("/api/notifications/unread-count")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(patientResponse.status, 200);
  assert.equal(patientResponse.body.data.unread_count, 1);
  assert.equal(doctorResponse.status, 200);
  assert.equal(doctorResponse.body.data.unread_count, 1);
});

test("Notification owner marks read idempotently while preserving read_at", async () => {
  const notification = await insertNotification(users.patient.id);
  const path = `/api/notifications/${notification.id}/read`;
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const first = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({});
  const second = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({});

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.notification.is_read, 1);
  assert.ok(first.body.data.notification.read_at);
  assert.equal(
    new Date(second.body.data.notification.read_at).getTime(),
    new Date(first.body.data.notification.read_at).getTime(),
  );
});

test("non-owners cannot discover or mark another user's Notification", async () => {
  const notification = await insertNotification(users.patient.id);

  for (const currentUser of [users.doctor, users.ngo, users.admin]) {
    const response = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
      .send({});

    assert.equal(response.status, 404);
    assert.equal(response.body.message, "Notification not found");
  }

  const stored = await db("notifications").where({ id: notification.id }).first();
  assert.equal(stored.is_read, 0);
  assert.equal(stored.read_at, null);
});

test("Notification read validates IDs and accepts no client fields", async () => {
  const notification = await insertNotification(users.patient.id);
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const malformed = await request(app)
    .patch("/api/notifications/not-an-id/read")
    .set("Authorization", authorization)
    .send({});
  const zero = await request(app)
    .patch("/api/notifications/0/read")
    .set("Authorization", authorization)
    .send({});
  const negative = await request(app)
    .patch("/api/notifications/-1/read")
    .set("Authorization", authorization)
    .send({});
  const outOfRange = await request(app)
    .patch("/api/notifications/18446744073709551616/read")
    .set("Authorization", authorization)
    .send({});
  const unknownField = await request(app)
    .patch(`/api/notifications/${notification.id}/read`)
    .set("Authorization", authorization)
    .send({ is_read: true });
  const missing = await request(app)
    .patch("/api/notifications/999999999/read")
    .set("Authorization", authorization)
    .send({});

  assert.equal(malformed.status, 400);
  assert.equal(zero.status, 400);
  assert.equal(negative.status, 400);
  assert.equal(outOfRange.status, 400);
  assert.equal(unknownField.status, 400);
  assert.equal(unknownField.body.errors.is_read, "is_read is not allowed");
  assert.equal(missing.status, 404);
});

test("read-all marks only the current user's unread Notifications", async () => {
  const patientUnread = await insertNotification(users.patient.id);
  const patientRead = await insertNotification(users.patient.id, {
    is_read: true,
    read_at: "2026-09-25 08:00:00",
  });
  const doctorUnread = await insertNotification(users.doctor.id);

  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.updated_count, 1);

  const [storedPatientUnread, storedPatientRead, storedDoctorUnread] =
    await Promise.all([
      db("notifications").where({ id: patientUnread.id }).first(),
      db("notifications").where({ id: patientRead.id }).first(),
      db("notifications").where({ id: doctorUnread.id }).first(),
    ]);

  assert.equal(storedPatientUnread.is_read, 1);
  assert.ok(storedPatientUnread.read_at);
  assert.equal(
    new Date(storedPatientRead.read_at).getTime(),
    new Date(patientRead.read_at).getTime(),
  );
  assert.equal(storedDoctorUnread.is_read, 0);
  assert.equal(storedDoctorUnread.read_at, null);
});

test("read-all rejects non-empty request bodies", async () => {
  const response = await request(app)
    .patch("/api/notifications/read-all")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({ user_id: users.doctor.id });

  assert.equal(response.status, 400);
  assert.equal(response.body.errors.user_id, "user_id is not allowed");
});

test("internal Notification references accept only existing approved entities", async () => {
  const notificationService = require("../src/services/notificationService");
  const assistanceRequest = await insertAssistanceRequest();
  const alertId = (
    await db("emergency_alerts").insert({
      patient_id: users.patientProfile.id,
      phone: "0591111111",
      priority: "HIGH",
      status: "PENDING_ASSIGNMENT",
    })
  )[0];
  const treatmentPlan = await insertTreatmentPlan();

  for (const [referenceType, referenceId] of [
    ["ASSISTANCE_REQUEST", assistanceRequest.id],
    ["EMERGENCY_ALERT", alertId],
    ["TREATMENT_PLAN", treatmentPlan.id],
  ]) {
    const entity = await notificationService.validateReference(
      referenceType,
      String(referenceId),
    );
    assert.equal(String(entity.id), String(referenceId));
  }

  await assert.rejects(
    notificationService.validateReference("MESSAGE", "1"),
    notificationService.NotificationValidationError,
  );
  await assert.rejects(
    notificationService.validateReference("TREATMENT_PLAN", "999999999"),
    notificationService.NotificationNotFoundError,
  );
  await assert.rejects(
    notificationService.validateReference(
      "TREATMENT_PLAN",
      "18446744073709551616",
    ),
    notificationService.NotificationValidationError,
  );
  await assert.rejects(
    notificationService.validateReference(
      "TREATMENT_PLAN",
      Number.MAX_SAFE_INTEGER + 1,
    ),
    notificationService.NotificationValidationError,
  );
});

test("Emergency Alert assignment notifies exactly the assigned Doctor", async () => {
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });

  const response = await request(app)
    .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ doctor_id: users.doctorProfile.id });

  assert.equal(response.status, 200);
  const notifications = await db("notifications");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.doctor.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alertId);
});

test("Emergency Alert IN_PROGRESS transition notifies exactly the registered Patient", async () => {
  const alert = await insertDoctorEmergencyAlert();

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "IN_PROGRESS" });

  assert.equal(response.status, 200);

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);

  assert.equal(storedAlert.status, "IN_PROGRESS");
  assert.ok(storedAlert.responded_at);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alert.id);
});

test("Emergency Alert RESOLVED transition notifies exactly the registered Patient", async () => {
  const alert = await insertDoctorEmergencyAlert({
    status: "IN_PROGRESS",
    responded_at: "2026-09-25 10:00:00",
  });

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "RESOLVED" });

  assert.equal(response.status, 200);

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);

  assert.equal(storedAlert.status, "RESOLVED");
  assert.equal(storedAlert.responded_at.getTime(), alert.responded_at.getTime());
  assert.ok(storedAlert.resolved_at);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_type, "EMERGENCY_ALERT");
  assert.equal(notifications[0].reference_id, alert.id);
});

test("Visitor Emergency Alert Doctor transitions succeed without Notifications", async () => {
  for (const [currentStatus, nextStatus] of [
    ["ASSIGNED", "IN_PROGRESS"],
    ["IN_PROGRESS", "RESOLVED"],
  ]) {
    const alert = await insertDoctorEmergencyAlert({
      patient_id: null,
      status: currentStatus,
      responded_at:
        currentStatus === "IN_PROGRESS" ? "2026-09-25 10:00:00" : null,
    });

    const response = await request(app)
      .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ status: nextStatus });

    assert.equal(response.status, 200);

    const [storedAlert, notifications] = await Promise.all([
      db("emergency_alerts").where({ id: alert.id }).first(),
      db("notifications").where({
        reference_type: "EMERGENCY_ALERT",
        reference_id: alert.id,
      }),
    ]);
    assert.equal(storedAlert.status, nextStatus);
    assert.equal(notifications.length, 0);
  }
});

test("rejected Doctor Emergency Alert transitions create no Notifications", async () => {
  const otherDoctor = await createSecondDoctor();
  const wrongDoctorAlert = await insertDoctorEmergencyAlert();
  const invalidTransitionAlert = await insertDoctorEmergencyAlert();

  const wrongDoctorResponse = await request(app)
    .patch(`/api/doctor/emergency-alerts/${wrongDoctorAlert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(otherDoctor.user)}`)
    .send({ status: "IN_PROGRESS" });
  const invalidTransitionResponse = await request(app)
    .patch(`/api/doctor/emergency-alerts/${invalidTransitionAlert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "RESOLVED" });

  assert.equal(wrongDoctorResponse.status, 404);
  assert.equal(invalidTransitionResponse.status, 409);
  assert.equal((await db("notifications")).length, 0);
});

test("Emergency Alert Notification failures roll back both Doctor transitions", async () => {
  const notificationModel = require("../src/models/notificationModel");
  const originalCreate = notificationModel.create;

  try {
    notificationModel.create = async () => {
      throw new Error("Injected Emergency Notification insert failure");
    };

    for (const [currentStatus, nextStatus] of [
      ["ASSIGNED", "IN_PROGRESS"],
      ["IN_PROGRESS", "RESOLVED"],
    ]) {
      const alert = await insertDoctorEmergencyAlert({
        status: currentStatus,
        responded_at:
          currentStatus === "IN_PROGRESS" ? "2026-09-25 10:00:00" : null,
        resolved_at: null,
        updated_at: "2026-01-01 00:00:00",
      });
      const originalRespondedAt = alert.responded_at?.getTime() ?? null;
      const originalResolvedAt = alert.resolved_at?.getTime() ?? null;
      const originalUpdatedAt = alert.updated_at.getTime();

      const response = await request(app)
        .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
        .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
        .send({ status: nextStatus });

      assert.equal(response.status, 500);

      const [storedAlert, notifications] = await Promise.all([
        db("emergency_alerts").where({ id: alert.id }).first(),
        db("notifications").where({
          reference_type: "EMERGENCY_ALERT",
          reference_id: alert.id,
        }),
      ]);

      assert.equal(storedAlert.status, currentStatus);
      assert.equal(storedAlert.responded_at?.getTime() ?? null, originalRespondedAt);
      assert.equal(storedAlert.resolved_at?.getTime() ?? null, originalResolvedAt);
      assert.equal(storedAlert.updated_at.getTime(), originalUpdatedAt);
      assert.equal(notifications.length, 0);
    }
  } finally {
    notificationModel.create = originalCreate;
  }
});

test("concurrent duplicate IN_PROGRESS transitions commit one Patient Notification", async () => {
  const alert = await insertDoctorEmergencyAlert();
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "IN_PROGRESS" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);
  assert.equal(storedAlert.status, "IN_PROGRESS");
  assert.ok(storedAlert.responded_at);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
});

test("concurrent duplicate RESOLVED transitions commit one additional Patient Notification", async () => {
  const alert = await insertDoctorEmergencyAlert({
    status: "IN_PROGRESS",
    responded_at: "2026-09-25 10:00:00",
  });
  await insertNotification(users.patient.id, {
    title: "Emergency Alert status updated",
    message: `Emergency Alert #${alert.id} is now IN_PROGRESS.`,
    type: "EMERGENCY_ALERT",
    reference_type: "EMERGENCY_ALERT",
    reference_id: alert.id,
  });
  const path = `/api/doctor/emergency-alerts/${alert.id}/status`;
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "RESOLVED" }),
    request(app)
      .patch(path)
      .set("Authorization", authorization)
      .send({ status: "RESOLVED" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );

  const [storedAlert, notifications] = await Promise.all([
    db("emergency_alerts").where({ id: alert.id }).first(),
    db("notifications").where({
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    }),
  ]);
  assert.equal(storedAlert.status, "RESOLVED");
  assert.equal(storedAlert.responded_at.getTime(), alert.responded_at.getTime());
  assert.ok(storedAlert.resolved_at);
  assert.equal(notifications.length, 2);
  assert.equal(
    notifications.filter((notification) =>
      notification.message.endsWith("is now RESOLVED."),
    ).length,
    1,
  );
});

test("Treatment Plan update notifies exactly the affected Patient", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(
      `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
    )
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ title: "Notification update" });

  assert.equal(response.status, 200);
  const notifications = await db("notifications");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "TREATMENT_PLAN");
  assert.equal(notifications[0].reference_type, "TREATMENT_PLAN");
  assert.equal(notifications[0].reference_id, plan.id);
});

test("each approved Assistance Request transition notifies Patient and submitting Doctor once", async () => {
  const ngo = await getPrimaryNgoProfile();

  for (const [currentStatus, nextStatus] of [
    ["PENDING", "UNDER_REVIEW"],
    ["UNDER_REVIEW", "APPROVED"],
    ["UNDER_REVIEW", "REJECTED"],
    ["APPROVED", "COMPLETED"],
  ]) {
    const assistanceRequest = await insertAssistanceRequest({
      ngo_id: ngo.id,
      status: currentStatus,
    });

    if (nextStatus === "COMPLETED") {
      await insertResourceAllocation(assistanceRequest.id);
    }

    const response = await request(app)
      .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
      .send({ status: nextStatus });

    assert.equal(response.status, 200);
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
        (notification) => notification.type === "ASSISTANCE_REQUEST",
      ),
    );
  }
});

test("failed and repeated Assistance Request transitions create no duplicate Notifications", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({ ngo_id: ngo.id });
  const path = `/api/ngo/assistance-requests/${assistanceRequest.id}/status`;
  const authorization = `Bearer ${tokenFor(users.ngo)}`;

  const invalid = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "APPROVED" });
  assert.equal(invalid.status, 409);
  assert.equal((await db("notifications")).length, 0);

  const successful = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "UNDER_REVIEW" });
  const repeated = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ status: "UNDER_REVIEW" });

  assert.equal(successful.status, 200);
  assert.equal(repeated.status, 409);
  assert.equal((await db("notifications")).length, 2);
});

test("Notification insertion failures roll back each integrated business mutation", async () => {
  const notificationModel = require("../src/models/notificationModel");
  const originalCreate = notificationModel.create;
  const ngo = await getPrimaryNgoProfile();
  const [alertId] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ title: "Original title" });
  let assistanceFailureIndex = null;
  let assistanceInsertCount = 0;
  let successfulAssistanceInserts = 0;

  try {
    notificationModel.create = async (notification, connection) => {
      if (notification.reference_type === "ASSISTANCE_REQUEST") {
        assistanceInsertCount += 1;

        if (assistanceInsertCount === assistanceFailureIndex) {
          throw new Error("Injected Notification insert failure");
        }

        const inserted = await originalCreate(notification, connection);
        successfulAssistanceInserts += 1;
        return inserted;
      }

      throw new Error("Injected Notification insert failure");
    };

    const emergencyResponse = await request(app)
      .patch(`/api/admin/emergency-alerts/${alertId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ doctor_id: users.doctorProfile.id });
    const treatmentResponse = await request(app)
      .patch(
        `/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`,
      )
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ title: "Must roll back" });

    assert.equal(emergencyResponse.status, 500);
    assert.equal(treatmentResponse.status, 500);

    for (const failureIndex of [1, 2]) {
      const assistanceRequest = await insertAssistanceRequest({
        ngo_id: ngo.id,
      });
      const originalUpdatedAt = new Date(assistanceRequest.updated_at).getTime();
      assistanceFailureIndex = failureIndex;
      assistanceInsertCount = 0;
      successfulAssistanceInserts = 0;

      const assistanceResponse = await request(app)
        .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
        .set("Authorization", `Bearer ${tokenFor(users.ngo)}`)
        .send({ status: "UNDER_REVIEW" });

      assert.equal(assistanceResponse.status, 500);
      assert.equal(assistanceInsertCount, failureIndex);
      assert.equal(successfulAssistanceInserts, failureIndex - 1);

      const storedAssistanceRequest = await db("assistance_requests")
        .where({ id: assistanceRequest.id })
        .first();
      const storedNotifications = await db("notifications").where({
        reference_type: "ASSISTANCE_REQUEST",
        reference_id: assistanceRequest.id,
      });

      assert.equal(storedAssistanceRequest.status, "PENDING");
      assert.equal(storedAssistanceRequest.reviewed_at, null);
      assert.equal(
        new Date(storedAssistanceRequest.updated_at).getTime(),
        originalUpdatedAt,
      );
      assert.equal(storedNotifications.length, 0);
    }
  } finally {
    notificationModel.create = originalCreate;
  }

  const [storedAlert, storedPlan] = await Promise.all([
    db("emergency_alerts").where({ id: alertId }).first(),
    db("treatment_plans").where({ id: plan.id }).first(),
  ]);

  assert.equal(storedAlert.status, "PENDING_ASSIGNMENT");
  assert.equal(storedAlert.assigned_doctor_id, null);
  assert.equal(storedPlan.title, "Original title");
  assert.equal((await db("notifications")).length, 0);
});

// ==============================
// Reminders
// ==============================

const REMINDER_COLUMNS = [
  "created_at",
  "id",
  "reference_id",
  "reference_type",
  "remind_at",
  "sent_at",
  "status",
  "type",
  "updated_at",
  "user_id",
];

function localDateTimeString(offsetSeconds) {
  const value = new Date(Date.now() + offsetSeconds * 1000);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

async function insertReminder(overrides = {}) {
  const plan = overrides.plan || (await insertTreatmentPlan());
  const reference =
    overrides.reference || (await insertTreatmentMedication(plan.id));
  const payload = {
    user_id: users.patient.id,
    type: "MEDICATION",
    reference_type: "TREATMENT_MEDICATION",
    reference_id: reference.id,
    remind_at: localDateTimeString(3600).replace("T", " "),
    status: "PENDING",
    sent_at: null,
    ...overrides,
  };
  delete payload.plan;
  delete payload.reference;

  const [id] = await db("reminders").insert(payload);
  return db("reminders").where({ id }).first();
}

test("Reminder endpoints require authentication and PATIENT role", async () => {
  const paths = [
    ["post", "/api/patient/reminders", {
      type: "MEDICATION",
      reference_id: "1",
      remind_at: localDateTimeString(3600),
    }],
    ["get", "/api/patient/reminders"],
    ["get", "/api/patient/reminders/1"],
    ["patch", "/api/patient/reminders/1/cancel", {}],
  ];

  for (const [method, path, body] of paths) {
    const unauthenticated = await request(app)[method](path).send(body);
    assert.equal(unauthenticated.status, 401);

    for (const currentUser of [users.doctor, users.ngo, users.admin]) {
      const forbidden = await request(app)[method](path)
        .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
        .send(body);
      assert.equal(forbidden.status, 403);
    }
  }
});

test("Patient creates owned Medication and Appointment Reminders with derived fields", async () => {
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);
  const appointment = await insertTreatmentAppointment(plan.id);
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  for (const [type, reference, referenceType] of [
    ["MEDICATION", medication, "TREATMENT_MEDICATION"],
    ["APPOINTMENT", appointment, "TREATMENT_APPOINTMENT"],
  ]) {
    const response = await request(app)
      .post("/api/patient/reminders")
      .set("Authorization", authorization)
      .send({
        type,
        reference_id: String(reference.id),
        remind_at: localDateTimeString(3600),
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.reminder.user_id, users.patient.id);
    assert.equal(response.body.data.reminder.type, type);
    assert.equal(response.body.data.reminder.reference_type, referenceType);
    assert.equal(response.body.data.reminder.reference_id, reference.id);
    assert.equal(response.body.data.reminder.status, "PENDING");
    assert.equal(response.body.data.reminder.sent_at, null);
  }
});

test("Reminder creation validates exact fields type IDs and future local datetime", async () => {
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const path = "/api/patient/reminders";
  const valid = {
    type: "MEDICATION",
    reference_id: medication.id,
    remind_at: localDateTimeString(3600),
  };
  const validLeapDay = await request(app)
    .post(path)
    .set("Authorization", authorization)
    .send({ ...valid, remind_at: "2028-02-29T10:00:00" });
  assert.equal(validLeapDay.status, 201);

  const reminderCount = async () =>
    db("reminders").count({ count: "id" }).first();
  const persistedBeforeRejections = Number((await reminderCount()).count);

  async function assertRejectedWithoutPersistence(body, expectedStatus = 400) {
    const response = await request(app)
      .post(path)
      .set("Authorization", authorization)
      .send(body);
    assert.equal(response.status, expectedStatus);
    assert.equal(Number((await reminderCount()).count), persistedBeforeRejections);
  }

  for (const field of ["type", "reference_id", "remind_at"]) {
    const body = { ...valid };
    delete body[field];
    await assertRejectedWithoutPersistence(body);
  }

  for (const body of [
    { ...valid, type: "TREATMENT_PLAN" },
    { ...valid, user_id: users.doctor.id },
    { ...valid, reference_type: "TREATMENT_MEDICATION" },
    { ...valid, status: "SENT" },
    { ...valid, sent_at: localDateTimeString(0) },
    { ...valid, created_at: localDateTimeString(0) },
    { ...valid, updated_at: localDateTimeString(0) },
    { ...valid, unknown: true },
    { ...valid, remind_at: "2027-02-29T10:00:00" },
    { ...valid, remind_at: "2026-02-30T10:00:00" },
    { ...valid, remind_at: "2028-02-29T24:00:00" },
    { ...valid, remind_at: "2028-02-29T10:60:00" },
    { ...valid, remind_at: "2028-02-29T10:00:60" },
    { ...valid, remind_at: "2026-12-01 10:00:00" },
    { ...valid, remind_at: "2026-12-01T10:00:00Z" },
    { ...valid, remind_at: "2028-02-29T10:00:00+02:00" },
    { ...valid, remind_at: localDateTimeString(-60) },
    { ...valid, remind_at: localDateTimeString(0) },
  ]) {
    await assertRejectedWithoutPersistence(body);
  }

  for (const referenceId of [
    0,
    -1,
    1.5,
    "not-an-id",
    Number.MAX_SAFE_INTEGER + 1,
    "18446744073709551616",
  ]) {
    await assertRejectedWithoutPersistence({ ...valid, reference_id: referenceId });
  }

  await assertRejectedWithoutPersistence(
    { ...valid, reference_id: "18446744073709551615" },
    404,
  );
});

test("Reminder reference validation enforces existence type and Patient ownership", async () => {
  const ownFirstPlan = await insertTreatmentPlan();
  const ownSecondPlan = await insertTreatmentPlan({ title: "Second own plan" });
  const ownMedication = await insertTreatmentMedication(ownSecondPlan.id);
  let mismatchedAppointment = await insertTreatmentAppointment(ownFirstPlan.id);
  while (
    await db("treatment_medications")
      .where({ id: mismatchedAppointment.id })
      .first()
  ) {
    mismatchedAppointment = await insertTreatmentAppointment(ownFirstPlan.id);
  }
  const otherPatient = await createSecondPatient();
  const otherPlan = await insertTreatmentPlan({
    patient_id: otherPatient.profile.id,
    title: "Other Patient plan",
  });
  const otherMedication = await insertTreatmentMedication(otherPlan.id);
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const own = await request(app)
    .post("/api/patient/reminders")
    .set("Authorization", authorization)
    .send({
      type: "MEDICATION",
      reference_id: ownMedication.id,
      remind_at: localDateTimeString(3600),
    });
  const missing = await request(app)
    .post("/api/patient/reminders")
    .set("Authorization", authorization)
    .send({
      type: "MEDICATION",
      reference_id: "999999999",
      remind_at: localDateTimeString(3600),
    });
  const forbidden = await request(app)
    .post("/api/patient/reminders")
    .set("Authorization", authorization)
    .send({
      type: "MEDICATION",
      reference_id: otherMedication.id,
      remind_at: localDateTimeString(3600),
    });
  const mismatch = await request(app)
    .post("/api/patient/reminders")
    .set("Authorization", authorization)
    .send({
      type: "MEDICATION",
      reference_id: mismatchedAppointment.id,
      remind_at: localDateTimeString(3600),
    });

  assert.equal(own.status, 201);
  assert.equal(missing.status, 404);
  assert.equal(forbidden.status, 403);
  assert.equal(mismatch.status, 404);
});

test("Patient Reminder list and detail are owner-scoped safe and deterministic", async () => {
  const plan = await insertTreatmentPlan();
  const medication = await insertTreatmentMedication(plan.id);
  const earlier = await insertReminder({
    plan,
    reference: medication,
    remind_at: "2026-12-10 10:00:00",
  });
  const tiedFirst = await insertReminder({
    plan,
    reference: medication,
    remind_at: "2026-12-11 10:00:00",
  });
  const tiedSecond = await insertReminder({
    plan,
    reference: medication,
    remind_at: "2026-12-11 10:00:00",
  });
  const otherPatient = await createSecondPatient();
  const otherReminder = await insertReminder({
    plan,
    reference: medication,
    user_id: otherPatient.user.id,
  });
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const list = await request(app)
    .get("/api/patient/reminders")
    .set("Authorization", authorization);
  const detail = await request(app)
    .get(`/api/patient/reminders/${earlier.id}`)
    .set("Authorization", authorization);
  const nonOwned = await request(app)
    .get(`/api/patient/reminders/${otherReminder.id}`)
    .set("Authorization", authorization);
  const missing = await request(app)
    .get("/api/patient/reminders/999999999")
    .set("Authorization", authorization);

  assert.equal(list.status, 200);
  assert.deepEqual(
    list.body.data.reminders.map((reminder) => reminder.id),
    [earlier.id, tiedFirst.id, tiedSecond.id],
  );
  assert.equal(detail.status, 200);
  assert.deepEqual(Object.keys(detail.body.data.reminder).sort(), REMINDER_COLUMNS);
  assert.equal(nonOwned.status, 404);
  assert.equal(missing.status, 404);

  await db("reminders").where({ user_id: users.patient.id }).del();
  const empty = await request(app)
    .get("/api/patient/reminders")
    .set("Authorization", authorization);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data.reminders, []);
});

test("Reminder detail and cancel validate hardened BIGINT identifiers", async () => {
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  for (const reminderId of ["0", "-1", "1.5", "bad", "18446744073709551616"]) {
    const detail = await request(app)
      .get(`/api/patient/reminders/${reminderId}`)
      .set("Authorization", authorization);
    const cancel = await request(app)
      .patch(`/api/patient/reminders/${reminderId}/cancel`)
      .set("Authorization", authorization)
      .send({});
    assert.equal(detail.status, 400);
    assert.equal(cancel.status, 400);
  }
});

test("Patient cancels only an owned PENDING Reminder with an empty body", async () => {
  const pending = await insertReminder({ updated_at: "2026-01-01 00:00:00" });
  const sent = await insertReminder({
    status: "SENT",
    sent_at: "2026-09-27 10:00:00",
  });
  const cancelled = await insertReminder({ status: "CANCELLED" });
  const otherPatient = await createSecondPatient();
  const other = await insertReminder({ user_id: otherPatient.user.id });
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const success = await request(app)
    .patch(`/api/patient/reminders/${pending.id}/cancel`)
    .set("Authorization", authorization)
    .send({});
  const sentConflict = await request(app)
    .patch(`/api/patient/reminders/${sent.id}/cancel`)
    .set("Authorization", authorization)
    .send({});
  const cancelledConflict = await request(app)
    .patch(`/api/patient/reminders/${cancelled.id}/cancel`)
    .set("Authorization", authorization)
    .send({});
  const nonOwned = await request(app)
    .patch(`/api/patient/reminders/${other.id}/cancel`)
    .set("Authorization", authorization)
    .send({});
  const missing = await request(app)
    .patch("/api/patient/reminders/999999999/cancel")
    .set("Authorization", authorization)
    .send({});
  const nonEmpty = await request(app)
    .patch(`/api/patient/reminders/${sent.id}/cancel`)
    .set("Authorization", authorization)
    .send({ status: "CANCELLED" });

  assert.equal(success.status, 200);
  const stored = await db("reminders").where({ id: pending.id }).first();
  assert.equal(stored.status, "CANCELLED");
  assert.equal(stored.sent_at, null);
  assert.ok(stored.updated_at.getTime() > pending.updated_at.getTime());
  assert.equal(sentConflict.status, 409);
  assert.equal(cancelledConflict.status, 409);
  assert.equal(nonOwned.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(nonEmpty.status, 400);
});

test("Concurrent Reminder cancellations allow exactly one success", async () => {
  const reminder = await insertReminder();
  const path = `/api/patient/reminders/${reminder.id}/cancel`;
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const responses = await Promise.all([
    request(app).patch(path).set("Authorization", authorization).send({}),
    request(app).patch(path).set("Authorization", authorization).send({}),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );
  assert.equal(
    (await db("reminders").where({ id: reminder.id }).first()).status,
    "CANCELLED",
  );
});

test("Reminder delivery sends due pending rows once and ignores future or cancelled rows", async () => {
  const reminderService = require("../src/services/reminderService");
  const due = await insertReminder({
    remind_at: localDateTimeString(-60).replace("T", " "),
    updated_at: "2026-01-01 00:00:00",
  });
  const future = await insertReminder({
    remind_at: localDateTimeString(3600).replace("T", " "),
  });
  const cancelled = await insertReminder({
    remind_at: localDateTimeString(-60).replace("T", " "),
    status: "CANCELLED",
  });

  const firstRun = await reminderService.deliverDueReminders(new Date());
  const secondRun = await reminderService.deliverDueReminders(new Date());
  const [storedDue, storedFuture, storedCancelled, notifications] =
    await Promise.all([
      db("reminders").where({ id: due.id }).first(),
      db("reminders").where({ id: future.id }).first(),
      db("reminders").where({ id: cancelled.id }).first(),
      db("notifications").where({
        reference_type: "REMINDER",
        reference_id: due.id,
      }),
    ]);

  assert.equal(firstRun.length, 1);
  assert.equal(secondRun.length, 0);
  assert.equal(storedDue.status, "SENT");
  assert.ok(storedDue.sent_at);
  assert.ok(storedDue.updated_at.getTime() > due.updated_at.getTime());
  assert.equal(storedFuture.status, "PENDING");
  assert.equal(storedCancelled.status, "CANCELLED");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, users.patient.id);
  assert.equal(notifications[0].type, "REMINDER");
  assert.equal(notifications[0].reference_type, "REMINDER");
  assert.equal(notifications[0].reference_id, due.id);
  assert.equal(notifications[0].title, "Reminder due");
  assert.equal(notifications[0].message, `Reminder #${due.id} is due.`);
});

test("Concurrent Reminder delivery commits exactly one Notification", async () => {
  const reminderService = require("../src/services/reminderService");
  const reminder = await insertReminder({
    remind_at: localDateTimeString(-60).replace("T", " "),
    updated_at: "2026-01-01 00:00:00",
  });
  const results = await Promise.all([
    reminderService.deliverReminder(reminder.id, new Date()),
    reminderService.deliverReminder(reminder.id, new Date()),
  ]);
  const stored = await db("reminders").where({ id: reminder.id }).first();
  const notifications = await db("notifications").where({
    reference_type: "REMINDER",
    reference_id: reminder.id,
  });

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(stored.status, "SENT");
  assert.equal(notifications.length, 1);
});

test("Reminder Notification failure rolls back delivery and a later retry succeeds", async () => {
  const notificationModel = require("../src/models/notificationModel");
  const reminderService = require("../src/services/reminderService");
  const originalCreate = notificationModel.create;
  const reminder = await insertReminder({
    remind_at: localDateTimeString(-60).replace("T", " "),
    updated_at: "2026-01-01 00:00:00",
  });
  const originalUpdatedAt = reminder.updated_at.getTime();

  try {
    notificationModel.create = async () => {
      throw new Error("Injected Reminder Notification failure");
    };
    await assert.rejects(
      reminderService.deliverReminder(reminder.id, new Date()),
      /Injected Reminder Notification failure/,
    );
  } finally {
    notificationModel.create = originalCreate;
  }

  let stored = await db("reminders").where({ id: reminder.id }).first();
  assert.equal(stored.status, "PENDING");
  assert.equal(stored.sent_at, null);
  assert.equal(stored.updated_at.getTime(), originalUpdatedAt);
  assert.equal(
    await db("notifications")
      .where({ reference_type: "REMINDER", reference_id: reminder.id })
      .then((rows) => rows.length),
    0,
  );

  const retried = await reminderService.deliverReminder(reminder.id, new Date());
  stored = await db("reminders").where({ id: reminder.id }).first();
  assert.equal(retried.status, "SENT");
  assert.equal(stored.status, "SENT");
  assert.equal(
    await db("notifications")
      .where({ reference_type: "REMINDER", reference_id: reminder.id })
      .then((rows) => rows.length),
    1,
  );
});

test("Concurrent Reminder cancellation and delivery produce one terminal outcome", async () => {
  const reminderService = require("../src/services/reminderService");
  const reminder = await insertReminder({
    remind_at: localDateTimeString(-60).replace("T", " "),
  });
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const [cancelResponse, deliveryResult] = await Promise.all([
    request(app)
      .patch(`/api/patient/reminders/${reminder.id}/cancel`)
      .set("Authorization", authorization)
      .send({}),
    reminderService.deliverReminder(reminder.id, new Date()),
  ]);
  const stored = await db("reminders").where({ id: reminder.id }).first();
  const notifications = await db("notifications").where({
    reference_type: "REMINDER",
    reference_id: reminder.id,
  });

  if (stored.status === "CANCELLED") {
    assert.equal(cancelResponse.status, 200);
    assert.equal(deliveryResult, null);
    assert.equal(notifications.length, 0);
  } else {
    assert.equal(stored.status, "SENT");
    assert.equal(cancelResponse.status, 409);
    assert.ok(deliveryResult);
    assert.equal(notifications.length, 1);
  }
});

test("Reminder Notification references validate existence recipient and legacy types", async () => {
  const notificationService = require("../src/services/notificationService");
  const reminder = await insertReminder({
    remind_at: localDateTimeString(-60).replace("T", " "),
  });

  const reference = await notificationService.validateReference(
    "REMINDER",
    reminder.id,
  );
  assert.equal(reference.id, reminder.id);
  await assert.rejects(
    notificationService.notifyReminderDue(
      reminder.id,
      users.doctor.id,
      db,
    ),
    notificationService.NotificationValidationError,
  );
  await assert.rejects(
    notificationService.validateReference("REMINDER", "999999999"),
    notificationService.NotificationNotFoundError,
  );

  for (const [type, id] of [
    ["TREATMENT_PLAN", (await insertTreatmentPlan()).id],
    ["EMERGENCY_ALERT", (
      await db("emergency_alerts").insert({
        patient_id: users.patientProfile.id,
        phone: "0591111111",
        priority: "HIGH",
        status: "PENDING_ASSIGNMENT",
      })
    )[0]],
    ["ASSISTANCE_REQUEST", (await insertAssistanceRequest()).id],
  ]) {
    assert.equal(
      String((await notificationService.validateReference(type, id)).id),
      String(id),
    );
  }
});

test("Reminder worker is one-minute and disabled in the test process", () => {
  const reminderWorker = require("../src/workers/reminderWorker");
  assert.equal(reminderWorker.REMINDER_INTERVAL_MS, 60000);
  assert.equal(reminderWorker.startReminderWorker(), null);
  reminderWorker.stopReminderWorker();
});

// ==============================
// Activity Logs
// ==============================

const ACTIVITY_LOG_COLUMNS = [
  "action",
  "created_at",
  "description",
  "entity_id",
  "entity_type",
  "id",
  "ip_address",
  "user_id",
];

async function insertActivityLog(overrides = {}) {
  const [id] = await db("activity_logs").insert({
    user_id: users.admin.id,
    action: "APPROVE_JOIN_REQUEST",
    entity_type: "JOIN_REQUEST",
    entity_id: "1",
    description: "Join Request #1 approved.",
    ip_address: "127.0.0.1",
    ...overrides,
  });

  return db("activity_logs").where({ id }).first();
}

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
  const activityLogModel = require("../src/models/activityLogModel");
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

// ==============================
// System Settings
// ==============================

const SYSTEM_SETTING_COLUMNS = [
  "description",
  "id",
  "setting_key",
  "setting_value",
  "updated_at",
];

async function seedSystemSettings() {
  await systemSettingsSeed.seed(db);
}

test("System Setting endpoints require ADMIN authentication", async () => {
  await seedSystemSettings();
  const paths = [
    ["get", "/api/admin/settings", undefined],
    ["get", "/api/admin/settings/system_name", undefined],
    ["patch", "/api/admin/settings/system_name", { setting_value: "HCMS 2" }],
  ];

  for (const [method, path, body] of paths) {
    let unauthenticated = request(app)[method](path);
    if (body) unauthenticated = unauthenticated.send(body);
    assert.equal((await unauthenticated).status, 401);

    for (const currentUser of [users.patient, users.doctor, users.ngo]) {
      let forbidden = request(app)
        [method](path)
        .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
      if (body) forbidden = forbidden.send(body);
      assert.equal((await forbidden).status, 403);
    }

    let admin = request(app)
      [method](path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`);
    if (body) admin = admin.send(body);
    assert.equal((await admin).status, 200);
  }
});

test("Admin lists only approved System Settings with safe ordered fields", async () => {
  await seedSystemSettings();
  await db("system_settings").insert({
    setting_key: "jwt_secret",
    setting_value: "must-not-leak",
    description: "Unapproved row",
  });

  const response = await request(app)
    .get("/api/admin/settings")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.settings.map((setting) => setting.setting_key),
    ["support_email", "support_phone", "system_name"],
  );
  for (const setting of response.body.data.settings) {
    assert.deepEqual(Object.keys(setting).sort(), SYSTEM_SETTING_COLUMNS);
  }
  assert.equal(JSON.stringify(response.body).includes("must-not-leak"), false);
});

test("Admin reads approved System Settings but cannot discover unapproved rows", async () => {
  await seedSystemSettings();
  await db("system_settings").insert({
    setting_key: "private_token",
    setting_value: "hidden",
    description: "Unapproved row",
  });
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  for (const key of ["system_name", "support_email", "support_phone"]) {
    const response = await request(app)
      .get(`/api/admin/settings/${key}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.setting.setting_key, key);
    assert.deepEqual(
      Object.keys(response.body.data.setting).sort(),
      SYSTEM_SETTING_COLUMNS,
    );
  }

  for (const key of ["unknown", "private_token"]) {
    const response = await request(app)
      .get(`/api/admin/settings/${key}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 404);
  }
});

test("System Setting value validation follows the approved catalog", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const update = (key, value) =>
    request(app)
      .patch(`/api/admin/settings/${key}`)
      .set("Authorization", authorization)
      .send({ setting_value: value });

  const systemName = await update("system_name", "  HCMS Portal  ");
  assert.equal(systemName.status, 200);
  assert.equal(systemName.body.data.setting.setting_value, "HCMS Portal");
  assert.equal(
    (await db("system_settings").where({ setting_key: "system_name" }).first())
      .setting_value,
    "HCMS Portal",
  );
  const hundredUnicodeCharacters = "😀".repeat(100);
  const exactSystemNameBoundary = await update(
    "system_name",
    hundredUnicodeCharacters,
  );
  assert.equal(exactSystemNameBoundary.status, 200);
  assert.equal(
    exactSystemNameBoundary.body.data.setting.setting_value,
    hundredUnicodeCharacters,
  );
  for (const value of [
    null,
    "",
    "   ",
    "😀".repeat(101),
    42,
    true,
    {},
    [],
  ]) {
    assert.equal((await update("system_name", value)).status, 400);
  }

  const email = await update("support_email", "  support@example.com  ");
  assert.equal(email.status, 200);
  assert.equal(email.body.data.setting.setting_value, "support@example.com");
  const exactEmailBoundary = `${"😀"}${"a".repeat(242)}@example.com`;
  assert.equal(Array.from(exactEmailBoundary).length, 255);
  const boundaryEmail = await update("support_email", exactEmailBoundary);
  assert.equal(boundaryEmail.status, 200);
  assert.equal(
    boundaryEmail.body.data.setting.setting_value,
    exactEmailBoundary,
  );
  assert.equal((await update("support_email", null)).status, 200);
  for (const value of [
    "",
    "   ",
    "invalid-email",
    `${"a".repeat(244)}@example.com`,
    42,
    true,
    {},
    [],
  ]) {
    assert.equal((await update("support_email", value)).status, 400);
  }

  const phone059 = await update("support_phone", "  0591234567  ");
  assert.equal(phone059.status, 200);
  assert.equal(phone059.body.data.setting.setting_value, "0591234567");
  assert.equal((await update("support_phone", "0561234567")).status, 200);
  assert.equal((await update("support_phone", null)).status, 200);
  for (const value of [
    "0581234567",
    "059123456",
    "05912345678",
    "05912345ab",
    "059 1234567",
    "059-1234567",
    "",
    "   ",
    591234567,
    true,
    {},
    [],
  ]) {
    assert.equal((await update("support_phone", value)).status, 400);
  }
});

test("System Setting PATCH rejects protected unknown and empty fields", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const rejectedBodies = [
    {},
    { id: 1, setting_value: "HCMS" },
    { setting_key: "system_name", setting_value: "HCMS" },
    { description: "Changed", setting_value: "HCMS" },
    { updated_by_admin_id: users.admin.id, setting_value: "HCMS" },
    { created_at: "2026-01-01", setting_value: "HCMS" },
    { updated_at: "2026-01-01", setting_value: "HCMS" },
    { unknown: true, setting_value: "HCMS" },
  ];

  for (const body of rejectedBodies) {
    const response = await request(app)
      .patch("/api/admin/settings/system_name")
      .set("Authorization", authorization)
      .send(body);
    assert.equal(response.status, 400);
  }
});

test("System Setting PATCH never creates unknown or missing catalog rows", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const unknown = await request(app)
    .patch("/api/admin/settings/arbitrary_key")
    .set("Authorization", authorization)
    .send({ setting_value: "value" });
  assert.equal(unknown.status, 404);
  assert.equal(
    await db("system_settings").where({ setting_key: "arbitrary_key" }).first(),
    undefined,
  );

  await db("system_settings").where({ setting_key: "support_email" }).del();
  const missing = await request(app)
    .patch("/api/admin/settings/support_email")
    .set("Authorization", authorization)
    .send({ setting_value: "support@example.com" });
  assert.equal(missing.status, 404);
  assert.equal(
    await db("system_settings").where({ setting_key: "support_email" }).first(),
    undefined,
  );
});

test("real System Setting update refreshes metadata and creates one safe Activity Log", async () => {
  await seedSystemSettings();
  await db("system_settings").where({ setting_key: "support_email" }).update({
    updated_at: "2026-01-01 00:00:00",
  });
  const before = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  const sensitiveValue = "private-support@example.com";

  const response = await request(app)
    .patch("/api/admin/settings/support_email")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ setting_value: sensitiveValue });
  assert.equal(response.status, 200);

  const stored = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  assert.equal(stored.setting_value, sensitiveValue);
  assert.equal(String(stored.updated_by_admin_id), String(users.admin.id));
  assert.ok(stored.updated_at.getTime() > before.updated_at.getTime());
  assert.deepEqual(
    Object.keys(response.body.data.setting).sort(),
    SYSTEM_SETTING_COLUMNS,
  );

  const logs = await db("activity_logs").where({
    action: "UPDATE_SYSTEM_SETTING",
    entity_type: "SYSTEM_SETTING",
    entity_id: stored.id,
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].description, `System Setting #${stored.id} updated`);
  assert.equal(String(logs[0].user_id), String(users.admin.id));
  assert.ok(["127.0.0.1", "::ffff:127.0.0.1"].includes(logs[0].ip_address));
  const serializedLog = JSON.stringify(logs[0]);
  assert.equal(serializedLog.includes("support_email"), false);
  assert.equal(serializedLog.includes(sensitiveValue), false);
});

test("same-value System Setting updates are successful no-ops", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const beforeName = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();

  const sameName = await request(app)
    .patch("/api/admin/settings/system_name")
    .set("Authorization", authorization)
    .send({ setting_value: "  HCMS  " });
  assert.equal(sameName.status, 200);
  assert.equal(sameName.body.data.setting.setting_value, "HCMS");

  const afterName = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.equal(afterName.setting_value, beforeName.setting_value);
  assert.equal(afterName.updated_by_admin_id, beforeName.updated_by_admin_id);
  assert.equal(afterName.updated_at.getTime(), beforeName.updated_at.getTime());

  const beforeEmail = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  const sameNull = await request(app)
    .patch("/api/admin/settings/support_email")
    .set("Authorization", authorization)
    .send({ setting_value: null });
  assert.equal(sameNull.status, 200);
  const afterEmail = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  assert.equal(afterEmail.setting_value, null);
  assert.equal(afterEmail.updated_by_admin_id, beforeEmail.updated_by_admin_id);
  assert.equal(afterEmail.updated_at.getTime(), beforeEmail.updated_at.getTime());
  assert.equal((await db("activity_logs")).length, 0);
});

test("Activity Log failure rolls back a real System Setting update", async () => {
  await seedSystemSettings();
  const activityLogModel = require("../src/models/activityLogModel");
  const originalCreate = activityLogModel.create;
  const before = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();

  let response;
  try {
    activityLogModel.create = async () => {
      throw new Error("Injected System Setting Activity Log failure");
    };
    response = await request(app)
      .patch("/api/admin/settings/system_name")
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ setting_value: "Changed Name" });
  } finally {
    activityLogModel.create = originalCreate;
  }

  assert.equal(response.status, 500);
  const afterFailure = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.equal(afterFailure.setting_value, before.setting_value);
  assert.equal(afterFailure.updated_by_admin_id, before.updated_by_admin_id);
  assert.equal(afterFailure.updated_at.getTime(), before.updated_at.getTime());
  assert.equal((await db("activity_logs")).length, 0);
});

test("concurrent same-value System Setting updates commit exactly one change log", async () => {
  await seedSystemSettings();
  await db("system_settings").where({ setting_key: "system_name" }).update({
    updated_at: "2026-01-01 00:00:00",
  });
  const before = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  const secondAdmin = await createUser({
    fullName: "Concurrent Settings Admin",
    email: "concurrent.settings.admin@test.local",
    role: "ADMIN",
  });
  const path = "/api/admin/settings/system_name";
  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ setting_value: "Concurrent HCMS" }),
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(secondAdmin)}`)
      .send({ setting_value: "Concurrent HCMS" }),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);

  const stored = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.equal(stored.setting_value, "Concurrent HCMS");
  assert.ok(stored.updated_at.getTime() > before.updated_at.getTime());
  const logs = await db("activity_logs").where({
    action: "UPDATE_SYSTEM_SETTING",
    entity_id: stored.id,
  });
  assert.equal(logs.length, 1);
  assert.equal(String(stored.updated_by_admin_id), String(logs[0].user_id));
  assert.ok(
    [users.admin.id, secondAdmin.id]
      .map(String)
      .includes(String(stored.updated_by_admin_id)),
  );
  for (const response of responses) {
    assert.equal(
      new Date(response.body.data.setting.updated_at).getTime(),
      stored.updated_at.getTime(),
    );
  }
});

test("concurrent different System Setting updates serialize with consistent logs", async () => {
  await seedSystemSettings();
  const path = "/api/admin/settings/system_name";
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const submittedValues = ["First Concurrent Name", "Second Concurrent Name"];
  const responses = await Promise.all(
    submittedValues.map((settingValue) =>
      request(app)
        .patch(path)
        .set("Authorization", authorization)
        .send({ setting_value: settingValue }),
    ),
  );
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);

  const stored = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.ok(submittedValues.includes(stored.setting_value));
  const logs = await db("activity_logs").where({
    action: "UPDATE_SYSTEM_SETTING",
    entity_id: stored.id,
  });
  assert.equal(logs.length, 2);
  assert.ok(
    responses.some(
      (response) =>
        response.body.data.setting.setting_value === stored.setting_value,
    ),
  );
});

test("System Setting seed is idempotent and preserves customized values", async () => {
  await seedSystemSettings();
  const customUpdatedAt = "2026-02-03 04:05:06";
  await db("system_settings").where({ setting_key: "system_name" }).update({
    setting_value: "Customized HCMS",
    updated_by_admin_id: users.admin.id,
    description: "Customized system display name",
    updated_at: customUpdatedAt,
  });
  await db("system_settings").where({ setting_key: "support_phone" }).del();

  await seedSystemSettings();

  const settings = await db("system_settings").orderBy("setting_key", "asc");
  assert.equal(settings.length, 3);
  assert.equal(
    settings.find((setting) => setting.setting_key === "system_name")
      .setting_value,
    "Customized HCMS",
  );
  assert.equal(
    String(
      settings.find((setting) => setting.setting_key === "system_name")
        .updated_by_admin_id,
    ),
    String(users.admin.id),
  );
  assert.equal(
    settings.find((setting) => setting.setting_key === "system_name")
      .description,
    "Customized system display name",
  );
  assert.equal(
    settings
      .find((setting) => setting.setting_key === "system_name")
      .updated_at.getTime(),
    new Date(customUpdatedAt).getTime(),
  );
  assert.equal(
    settings.find((setting) => setting.setting_key === "support_phone")
      .setting_value,
    null,
  );
});

// ==============================
// Dashboards and Basic Reports
// ==============================

const DASHBOARD_KEYS = {
  ADMIN: [
    "active_emergency_alerts",
    "pending_assistance_requests",
    "pending_join_requests",
    "total_doctors",
    "total_ngos",
    "total_patients",
  ],
  PATIENT: [
    "active_emergency_alerts",
    "active_treatment_plans",
    "pending_assistance_requests",
    "pending_reminders",
    "unread_notifications",
  ],
  DOCTOR: [
    "active_patients",
    "assigned_emergency_alerts",
    "submitted_assistance_requests",
  ],
  NGO: ["assigned_assistance_requests", "resource_allocations"],
};

const DASHBOARD_PATHS = {
  ADMIN: "/api/admin/dashboard",
  PATIENT: "/api/patient/dashboard",
  DOCTOR: "/api/doctor/dashboard",
  NGO: "/api/ngo/dashboard",
};

test("Dashboard endpoints enforce authentication RBAC exact numeric keys and no read logs", async () => {
  for (const [role, path] of Object.entries(DASHBOARD_PATHS)) {
    assert.equal((await request(app).get(path)).status, 401);

    for (const wrongUser of [
      users.patient,
      users.doctor,
      users.ngo,
      users.admin,
    ].filter((user) => user.role !== role)) {
      const forbidden = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${tokenFor(wrongUser)}`);
      assert.equal(forbidden.status, 403);
    }

    const currentUser = users[role.toLowerCase()];
    const response = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body.data).sort(), DASHBOARD_KEYS[role]);
    assert.ok(
      Object.values(response.body.data).every(
        (metric) => typeof metric === "number" && Number.isInteger(metric),
      ),
    );
  }

  assert.equal((await db("activity_logs")).length, 0);
});

test("Admin dashboard applies approved active-account and current-status metrics", async () => {
  const inactivePatient = await createUser({
    fullName: "Inactive Dashboard Patient",
    email: "inactive.dashboard.patient@test.local",
    role: "PATIENT",
    accountStatus: "INACTIVE",
  });
  await db("patients").insert({
    user_id: inactivePatient.id,
    national_id: "723456789",
    date_of_birth: "1990-01-01",
    gender: "MALE",
  });
  const inactiveDoctor = await createUser({
    fullName: "Inactive Dashboard Doctor",
    email: "inactive.dashboard.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });
  await db("doctors").insert({
    user_id: inactiveDoctor.id,
    specialization: "General Medicine",
    license_number: "DASHBOARD-INACTIVE-DOC",
  });
  const inactiveNgo = await createUser({
    fullName: "Inactive Dashboard NGO",
    email: "inactive.dashboard.ngo@test.local",
    role: "NGO",
    accountStatus: "INACTIVE",
  });
  await db("ngos").insert({
    user_id: inactiveNgo.id,
    organization_name: "Inactive Dashboard NGO",
    registration_number: "DASHBOARD-INACTIVE-NGO",
  });
  await db("join_requests").insert([
    { user_id: inactiveDoctor.id, request_type: "DOCTOR", status: "PENDING" },
    { user_id: inactiveNgo.id, request_type: "NGO", status: "APPROVED" },
  ]);
  await insertDoctorEmergencyAlert({ status: "RESOLVED", resolved_at: db.fn.now() });
  await db("emergency_alerts").insert({
    patient_id: null,
    phone: "0599999999",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
  await insertAssistanceRequest({ status: "PENDING" });
  await insertAssistanceRequest({ status: "APPROVED" });

  const response = await request(app)
    .get(DASHBOARD_PATHS.ADMIN)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    total_patients: 1,
    total_doctors: 1,
    total_ngos: 1,
    pending_join_requests: 1,
    active_emergency_alerts: 1,
    pending_assistance_requests: 1,
  });
});

test("Patient dashboard counts only own current data with existing unread semantics", async () => {
  const other = await createSecondPatientForAssistanceRequests();
  const completedPlan = await insertTreatmentPlan({ status: "COMPLETED" });
  const medication = await insertTreatmentMedication(completedPlan.id);
  await insertTreatmentPlan();
  await insertReminder({ plan: completedPlan, reference: medication });
  await insertReminder({
    plan: completedPlan,
    reference: medication,
    status: "SENT",
    sent_at: db.fn.now(),
  });
  await insertDoctorEmergencyAlert({ status: "PENDING_ASSIGNMENT", assigned_doctor_id: null });
  await insertDoctorEmergencyAlert({ status: "RESOLVED", resolved_at: db.fn.now() });
  await db("emergency_alerts").insert({
    patient_id: null,
    phone: "0598888888",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
  await db("emergency_alerts").insert({
    patient_id: other.patientProfile.id,
    phone: "0597777777",
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
  await insertAssistanceRequest({ status: "PENDING" });
  await insertAssistanceRequest({ status: "APPROVED" });
  await insertAssistanceRequest({ patient_id: other.patientProfile.id, status: "PENDING" });
  await insertNotification(users.patient.id);
  await insertNotification(users.patient.id, { is_read: true, read_at: db.fn.now() });
  await insertNotification(other.patientUser.id);

  const response = await request(app)
    .get(DASHBOARD_PATHS.PATIENT)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    active_treatment_plans: 1,
    pending_reminders: 1,
    active_emergency_alerts: 1,
    pending_assistance_requests: 1,
    unread_notifications: 1,
  });
});

test("Doctor dashboard uses distinct active patients and own all-status submissions", async () => {
  const otherPatient = await createSecondPatientForAssistanceRequests();
  const otherDoctor = await createSecondDoctor();
  await insertActiveAssignment();
  await insertActiveAssignment();
  await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: otherPatient.patientProfile.id,
    status: "INACTIVE",
    ended_at: db.fn.now(),
  });
  await db("doctor_patient_assignments").insert({
    doctor_id: otherDoctor.profile.id,
    patient_id: otherPatient.patientProfile.id,
    status: "ACTIVE",
  });
  await insertDoctorEmergencyAlert({ status: "ASSIGNED" });
  await insertDoctorEmergencyAlert({ status: "RESOLVED", resolved_at: db.fn.now() });
  await insertDoctorEmergencyAlert({ assigned_doctor_id: otherDoctor.profile.id });
  await insertAssistanceRequest({ status: "PENDING" });
  await insertAssistanceRequest({ status: "COMPLETED" });
  await insertAssistanceRequest({ doctor_id: otherDoctor.profile.id });

  const response = await request(app)
    .get(DASHBOARD_PATHS.DOCTOR)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    active_patients: 1,
    assigned_emergency_alerts: 1,
    submitted_assistance_requests: 2,
  });
});

test("NGO dashboard counts assigned requests and allocation rows rather than quantity", async () => {
  const ownNgo = await getPrimaryNgoProfile();
  const otherNgo = await createAssistanceNgo({
    email: "dashboard.other.ngo@test.local",
    registrationNumber: "DASHBOARD-OTHER-NGO",
  });
  const ownFirst = await insertAssistanceRequest({ ngo_id: ownNgo.id, status: "APPROVED" });
  await insertAssistanceRequest({ ngo_id: ownNgo.id, status: "COMPLETED" });
  const otherRequest = await insertAssistanceRequest({ ngo_id: otherNgo.profile.id });
  await insertResourceAllocation(ownFirst.id, { quantity: 100 });
  await insertResourceAllocation(ownFirst.id, { quantity: 1, resource_name: "Blankets" });
  await insertResourceAllocation(otherRequest.id, { quantity: 50 });

  const response = await request(app)
    .get(DASHBOARD_PATHS.NGO)
    .set("Authorization", `Bearer ${tokenFor(users.ngo)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, {
    assigned_assistance_requests: 2,
    resource_allocations: 2,
  });
});

test("Role dashboards return 404 when the authenticated role profile is missing", async () => {
  for (const [role, table] of [
    ["PATIENT", "patients"],
    ["DOCTOR", "doctors"],
    ["NGO", "ngos"],
  ]) {
    const currentUser = users[role.toLowerCase()];
    await db(table).where({ user_id: currentUser.id }).del();
    const response = await request(app)
      .get(DASHBOARD_PATHS[role])
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
    assert.equal(response.status, 404);
  }
});

const REPORT_PATHS = [
  "/api/admin/reports/patients",
  "/api/admin/reports/treatment-plans",
  "/api/admin/reports/assistance-requests",
];

test("Admin reports enforce authentication and ADMIN-only RBAC", async () => {
  for (const path of REPORT_PATHS) {
    assert.equal((await request(app).get(path)).status, 401);
    for (const currentUser of [users.patient, users.doctor, users.ngo]) {
      const response = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
      assert.equal(response.status, 403);
    }
    const allowed = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`);
    assert.equal(allowed.status, 200);
  }
});

test("Patient report exposes only its approved projection with deterministic pagination", async () => {
  const second = await createSecondPatientForAssistanceRequests();
  await db("patients").where({ id: users.patientProfile.id }).update({
    created_at: "2026-01-01 00:00:00",
  });
  await db("patients").where({ id: second.patientProfile.id }).update({
    created_at: "2026-01-02 00:00:00",
  });

  const response = await request(app)
    .get("/api/admin/reports/patients?page=1&limit=1")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    {
      page: response.body.data.page,
      limit: response.body.data.limit,
      total: response.body.data.total,
      total_pages: response.body.data.total_pages,
    },
    { page: 1, limit: 1, total: 2, total_pages: 2 },
  );
  assert.equal(response.body.data.items[0].id, second.patientProfile.id);
  assert.deepEqual(Object.keys(response.body.data.items[0]).sort(), [
    "created_at",
    "full_name",
    "id",
    "user_id",
  ]);
  assert.equal(response.body.data.items[0].full_name, second.patientUser.full_name);
  for (const forbidden of ["national_id", "phone", "email", "password_hash"]) {
    assert.equal(forbidden in response.body.data.items[0], false);
  }
});

test("Treatment Plan report exposes exact fields and deterministic newest-first order", async () => {
  const older = await insertTreatmentPlan({ created_at: "2026-01-01 00:00:00" });
  const newerFirst = await insertTreatmentPlan({ created_at: "2026-01-02 00:00:00" });
  const newerSecond = await insertTreatmentPlan({ created_at: "2026-01-02 00:00:00" });

  const response = await request(app)
    .get("/api/admin/reports/treatment-plans")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.items.map((item) => item.id),
    [newerSecond.id, newerFirst.id, older.id],
  );
  assert.deepEqual(Object.keys(response.body.data.items[0]).sort(), [
    "created_at",
    "doctor_id",
    "end_date",
    "id",
    "patient_id",
    "start_date",
    "status",
  ]);
  assert.equal("general_instructions" in response.body.data.items[0], false);
  assert.equal(response.body.data.items[0].start_date, "2026-09-21");
});

test("Assistance Request report filters items and total using exact safe fields", async () => {
  await insertAssistanceRequest({ status: "PENDING", created_at: "2026-01-01 00:00:00" });
  const approvedFirst = await insertAssistanceRequest({
    status: "APPROVED",
    created_at: "2026-01-02 00:00:00",
  });
  const approvedSecond = await insertAssistanceRequest({
    status: "APPROVED",
    created_at: "2026-01-02 00:00:00",
  });

  const response = await request(app)
    .get("/api/admin/reports/assistance-requests?status=APPROVED")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.total, 2);
  assert.deepEqual(
    response.body.data.items.map((item) => item.id),
    [approvedSecond.id, approvedFirst.id],
  );
  assert.ok(response.body.data.items.every((item) => item.status === "APPROVED"));
  assert.deepEqual(Object.keys(response.body.data.items[0]).sort(), [
    "created_at",
    "doctor_id",
    "id",
    "ngo_id",
    "patient_id",
    "request_type",
    "status",
    "updated_at",
  ]);
  assert.equal("description" in response.body.data.items[0], false);
});

test("Report query validation enforces pagination safety allowlists and status enum", async () => {
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const rejected = [
    [REPORT_PATHS[0], "page=0"],
    [REPORT_PATHS[0], "page=-1"],
    [REPORT_PATHS[0], "page=1.5"],
    [REPORT_PATHS[0], "limit=0"],
    [REPORT_PATHS[0], "limit=101"],
    [REPORT_PATHS[0], "page=9007199254740991&limit=2"],
    [REPORT_PATHS[0], "unknown=value"],
    [REPORT_PATHS[0], "page=1&page=2"],
    [REPORT_PATHS[2], "status=INVALID"],
    [REPORT_PATHS[1], "status=ACTIVE"],
  ];

  for (const [path, query] of rejected) {
    const response = await request(app)
      .get(`${path}?${query}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 400, `${path}?${query}`);
  }

  const maximum = await request(app)
    .get(`${REPORT_PATHS[0]}?page=1&limit=100`)
    .set("Authorization", authorization);
  assert.equal(maximum.status, 200);
  assert.equal(maximum.body.data.limit, 100);

  for (const status of [
    "PENDING",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "COMPLETED",
  ]) {
    await insertAssistanceRequest({ status });
    const response = await request(app)
      .get(`${REPORT_PATHS[2]}?status=${status}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.total, 1);
    assert.equal(response.body.data.items.length, 1);
    assert.equal(response.body.data.items[0].status, status);
  }
});

test("Reports preserve requested empty-page metadata and create no Activity Logs", async () => {
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  for (const path of REPORT_PATHS) {
    const defaults = await request(app)
      .get(path)
      .set("Authorization", authorization);
    assert.equal(defaults.status, 200);
    assert.equal(defaults.body.data.page, 1);
    assert.equal(defaults.body.data.limit, 20);

    const response = await request(app)
      .get(`${path}?page=50&limit=2`)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.items, []);
    assert.equal(response.body.data.page, 50);
    assert.equal(response.body.data.limit, 2);

    const maximum = await request(app)
      .get(`${path}?limit=100`)
      .set("Authorization", authorization);
    assert.equal(maximum.status, 200);
    assert.equal(maximum.body.data.limit, 100);
  }
  assert.equal((await db("activity_logs")).length, 0);
});

test("All reports return the approved zero-total empty state", async () => {
  await db("patients").del();
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  for (const path of REPORT_PATHS) {
    const response = await request(app)
      .get(`${path}?page=3&limit=7`)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      items: [],
      page: 3,
      limit: 7,
      total: 0,
      total_pages: 0,
    });
  }
});
