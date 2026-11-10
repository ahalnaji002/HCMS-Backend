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
  insertTreatmentMedication,
  createSecondPatient,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Treatment Medications Management
registerIntegrationHooks();

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
