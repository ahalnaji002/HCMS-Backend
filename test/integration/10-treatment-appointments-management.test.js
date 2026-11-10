const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertActiveAssignment,
  createSecondDoctor,
  insertTreatmentPlan,
  insertTreatmentAppointment,
  createSecondPatient,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Treatment Appointments Management
registerIntegrationHooks();

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
