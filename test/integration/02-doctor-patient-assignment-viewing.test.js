const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  users,
  tokenFor,
  insertAssignment,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Doctor-Patient Assignment Viewing
registerIntegrationHooks();

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
    "doctor_name",
    "ended_at",
    "id",
    "notes",
    "patient_id",
    "patient_name",
    "specialization",
    "status",
    "updated_at",
  ]);
});

test("assignment list and detail include patient and doctor display names", async () => {
  const assignment = await insertAssignment();
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const expected = {
    patient_name: users.patient.full_name,
    doctor_name: users.doctor.full_name,
    specialization: users.doctorProfile.specialization,
  };

  const list = await request(app)
    .get("/api/admin/doctor-patient-assignments")
    .set("Authorization", authorization);
  assert.equal(list.status, 200);
  const listed = list.body.data.assignments[0];
  assert.deepEqual(
    { patient_name: listed.patient_name, doctor_name: listed.doctor_name, specialization: listed.specialization },
    expected,
  );

  const detail = await request(app)
    .get(`/api/admin/doctor-patient-assignments/${assignment.id}`)
    .set("Authorization", authorization);
  assert.equal(detail.status, 200);
  const shown = detail.body.data.assignment;
  assert.deepEqual(
    { patient_name: shown.patient_name, doctor_name: shown.doctor_name, specialization: shown.specialization },
    expected,
  );
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
