const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const db = require("../src/config/database");
const { signToken } = require("../src/services/tokenService");

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

before(async () => {
  await verifyTestDatabase();
});

beforeEach(async () => {
  assertTestDatabaseVerified();

  await db("medical_notes").del();
  await db("treatment_medications").del();
  await db("treatment_appointments").del();
  await db("treatment_plans").del();
  await db("medical_records").del();
  await db("doctor_patient_assignments").del();
  await db("ngos").del();
  await db("doctors").del();
  await db("patients").del();
  await db("users").del();

  users = await createFixtures();
});

after(async () => {
  try {
    if (testDatabaseVerified) {
      await db("medical_notes").del();
      await db("treatment_medications").del();
      await db("treatment_appointments").del();
      await db("treatment_plans").del();
      await db("medical_records").del();
      await db("doctor_patient_assignments").del();
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
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.role);
  assert.ok(response.body.errors.specialization);

  const patient = await db("users").where({ id: users.patient.id }).first();

  assert.equal(patient.role, "PATIENT");
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
