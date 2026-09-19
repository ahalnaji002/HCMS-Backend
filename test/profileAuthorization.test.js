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
