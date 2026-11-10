const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  createUser,
  tokenFor,
  createSecondDoctor,
  insertDoctorEmergencyAlert,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Emergency Alerts
registerIntegrationHooks();

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
