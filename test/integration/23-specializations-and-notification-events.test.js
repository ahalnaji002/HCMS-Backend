const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  createSecondDoctor,
  doctorRegistration,
  insertActiveAssignment,
  insertDoctorEmergencyAlert,
  insertNotification,
  insertTreatmentPlan,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");
const {
  SPECIALIZATIONS,
  EMERGENCY_ELIGIBLE_SPECIALIZATIONS,
} = require("../../src/utils/specializations");
const normalizeSpecializations = require("../../database/migrations/202611270001_normalize_doctor_specializations");
const addNotificationEvents = require("../../database/migrations/202611270002_add_event_to_notifications");

// Fixed Doctor specializations and language-neutral Notification events
registerIntegrationHooks();

test("the emergency-eligible specializations are part of the fixed list", () => {
  for (const name of EMERGENCY_ELIGIBLE_SPECIALIZATIONS) {
    assert.ok(SPECIALIZATIONS.includes(name), name);
  }
  assert.equal(new Set(SPECIALIZATIONS).size, SPECIALIZATIONS.length);
});

test("doctor registration rejects a specialization outside the fixed list", async () => {
  for (const specialization of ["Surgeon of everything", "general medicine", "طب عام"]) {
    const response = await request(app)
      .post("/api/auth/register/doctor")
      .send(doctorRegistration({ specialization }));

    assert.equal(response.status, 400, specialization);
    assert.equal(
      response.body.errors.specialization,
      "specialization must be one of the listed specializations",
    );
  }
  assert.equal(
    Number((await db("users").where({ role: "DOCTOR" }).count("id as count"))[0].count),
    1,
  );
});

test("doctor registration stores a listed specialization without surrounding spaces", async () => {
  const payload = doctorRegistration({ specialization: "  Emergency Medicine " });
  const response = await request(app)
    .post("/api/auth/register/doctor")
    .send(payload);

  assert.equal(response.status, 201);
  const user = await db("users").where({ email: payload.email }).first();
  const doctor = await db("doctors").where({ user_id: user.id }).first();
  assert.equal(doctor.specialization, "Emergency Medicine");
});

test("the specialization migration maps known free text and keeps unknown values", async () => {
  const second = await createSecondDoctor();
  await db("doctors").where({ id: users.doctorProfile.id }).update({ specialization: " طب  عام " });
  await db("doctors").where({ id: second.profile.id }).update({ specialization: "Space medicine" });

  await normalizeSpecializations.up(db);

  assert.equal(
    (await db("doctors").where({ id: users.doctorProfile.id }).first()).specialization,
    "General Medicine",
  );
  assert.equal(
    (await db("doctors").where({ id: second.profile.id }).first()).specialization,
    "Space medicine",
  );
});

test("the specialization migration fixes case and spacing of listed names", async () => {
  const second = await createSecondDoctor();
  await db("doctors").where({ id: users.doctorProfile.id }).update({ specialization: "emergency   medicine" });
  await db("doctors").where({ id: second.profile.id }).update({ specialization: "Cardiology" });

  await normalizeSpecializations.up(db);

  assert.equal(
    (await db("doctors").where({ id: users.doctorProfile.id }).first()).specialization,
    "Emergency Medicine",
  );
  assert.equal(
    (await db("doctors").where({ id: second.profile.id }).first()).specialization,
    "Cardiology",
  );
});

test("a migrated free-text General Medicine Doctor becomes eligible for Emergency Alerts", async () => {
  await db("doctors").where({ id: users.doctorProfile.id }).update({ specialization: "General practitioner" });
  const alert = await insertDoctorEmergencyAlert({
    status: "PENDING_ASSIGNMENT",
    assigned_doctor_id: null,
    assigned_by_admin_id: null,
    assigned_at: null,
  });
  const path = `/api/admin/emergency-alerts/${alert.id}/assign`;
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const before = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ doctor_id: users.doctorProfile.id });
  assert.equal(before.status, 400);

  await normalizeSpecializations.up(db);

  const after = await request(app)
    .patch(path)
    .set("Authorization", authorization)
    .send({ doctor_id: users.doctorProfile.id });
  assert.equal(after.status, 200);
});

test("Emergency Alert notifications carry the event and the new status", async () => {
  const alert = await insertDoctorEmergencyAlert({ status: "ASSIGNED" });

  const response = await request(app)
    .patch(`/api/doctor/emergency-alerts/${alert.id}/status`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ status: "IN_PROGRESS" });
  assert.equal(response.status, 200);

  const list = await request(app)
    .get("/api/notifications")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  assert.equal(list.status, 200);
  const [notification] = list.body.data.notifications;
  assert.equal(notification.event, "EMERGENCY_ALERT_STATUS_CHANGED");
  assert.equal(notification.event_status, "IN_PROGRESS");
  assert.equal(notification.reference_id, alert.id);
  assert.equal(notification.message, `Emergency Alert #${alert.id} is now IN_PROGRESS.`);
});

test("Treatment Plan notifications carry the event without a status", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();

  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ title: "Event update" });
  assert.equal(response.status, 200);

  const [notification] = await db("notifications");
  assert.equal(notification.event, "TREATMENT_PLAN_UPDATED");
  assert.equal(notification.event_status, null);
});

test("the notification migration back-fills events from the fixed templates", async () => {
  const assigned = await insertNotification(users.doctor.id, {
    title: "Emergency Alert assigned",
    message: "Emergency Alert #7 has been assigned to you.",
    type: "EMERGENCY_ALERT",
  });
  const changed = await insertNotification(users.patient.id, {
    title: "Assistance Request status updated",
    message: "Assistance Request #9 is now UNDER_REVIEW.",
    type: "ASSISTANCE_REQUEST",
  });
  const custom = await insertNotification(users.patient.id, {
    title: "Something else",
  });

  await addNotificationEvents.down(db);
  await addNotificationEvents.up(db);

  const rows = await db("notifications")
    .whereIn("id", [assigned.id, changed.id, custom.id])
    .orderBy("id");
  assert.deepEqual(
    rows.map(({ event, event_status }) => [event, event_status]),
    [
      ["EMERGENCY_ALERT_ASSIGNED", null],
      ["ASSISTANCE_REQUEST_STATUS_CHANGED", "UNDER_REVIEW"],
      [null, null],
    ],
  );
});
