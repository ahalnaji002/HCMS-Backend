const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  createUser,
  tokenFor,
  insertActiveAssignment,
  createSecondDoctor,
  insertTreatmentPlan,
  insertTreatmentMedication,
  insertDoctorEmergencyAlert,
  insertAssistanceRequest,
  createSecondPatientForAssistanceRequests,
  getPrimaryNgoProfile,
  createAssistanceNgo,
  insertResourceAllocation,
  insertNotification,
  insertReminder,
  DASHBOARD_KEYS,
  DASHBOARD_PATHS,
  REPORT_PATHS,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Dashboards and Basic Reports
registerIntegrationHooks();

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
  // A cancelled alert is closed and must not count as active.
  await db("emergency_alerts").insert({
    patient_id: null,
    phone: "0599999998",
    priority: "HIGH",
    status: "CANCELLED",
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
  await insertDoctorEmergencyAlert({ status: "CANCELLED", assigned_doctor_id: null });
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
    if (role === "PATIENT") {
      await db("intake_correction_requests").where({ patient_id: users.patientProfile.id }).del();
      await db("doctor_diagnoses").where({ patient_id: users.patientProfile.id }).del();
      await db("patient_intakes").where({ patient_id: users.patientProfile.id }).del();
    }
    await db(table).where({ user_id: currentUser.id }).del();
    const response = await request(app)
      .get(DASHBOARD_PATHS[role])
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
    assert.equal(response.status, 404);
  }
});

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
  const older = await insertTreatmentPlan({ end_date: null, created_at: "2026-01-01 00:00:00" });
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
  const reportItemsById = new Map(response.body.data.items.map((item) => [item.id, item]));
  assert.equal(reportItemsById.get(older.id).start_date, "2026-09-21");
  assert.equal(reportItemsById.get(older.id).end_date, null);
  assert.equal(reportItemsById.get(newerFirst.id).start_date, "2026-09-21");
  assert.equal(reportItemsById.get(newerFirst.id).end_date, "2026-10-21");
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
  await db("intake_correction_requests").del();
  await db("doctor_diagnoses").del();
  await db("patient_intakes").del();
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
