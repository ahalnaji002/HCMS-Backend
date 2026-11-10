const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  treatmentAppointmentModel,
  treatmentPlanModel,
  users,
  createUser,
  tokenFor,
  insertActiveAssignment,
  createSecondDoctor,
  insertTreatmentPlan,
  databaseDateOnly,
  databaseDateTime,
  createDeferred,
  waitForBounded,
  captureConnectionBeforeModelLock,
  getTreatmentPlanRecordLock,
  waitForTreatmentPlanLockWait,
  observeNextApiOperation,
  startBoundedRequest,
  cleanupConcurrencyTest,
  insertTreatmentAppointment,
  markUnsafeTestDatabaseState,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Treatment Plans Management
registerIntegrationHooks();

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

test("treatment calendar dates and Asia/Hebron appointment wall-clock survive API round trips", async () => {
  await insertActiveAssignment();
  const token = `Bearer ${tokenFor(users.doctor)}`;
  const createPlan = await request(app)
    .post(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", token)
    .send({
      title: "Timezone Contract Plan",
      start_date: "2026-10-31",
      end_date: null,
    });

  assert.equal(createPlan.status, 201);
  const plan = createPlan.body.data.treatment_plan;
  assert.equal(plan.start_date, "2026-10-31");
  assert.equal(plan.end_date, null);
  const storedPlan = await db.raw(
    "SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date FROM treatment_plans WHERE id = ?",
    [plan.id],
  );
  assert.deepEqual(storedPlan[0][0], { start_date: "2026-10-31", end_date: null });

  const doctorPlanList = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans`)
    .set("Authorization", token);
  const doctorPlanDetail = await request(app)
    .get(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`)
    .set("Authorization", token);
  const patientPlanList = await request(app)
    .get("/api/patient/treatment-plans")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const patientPlanDetail = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  for (const response of [doctorPlanList, doctorPlanDetail, patientPlanList, patientPlanDetail]) {
    assert.equal(response.status, 200);
  }
  for (const item of [
    doctorPlanList.body.data.treatment_plans[0],
    doctorPlanDetail.body.data.treatment_plan,
    patientPlanList.body.data.treatment_plans[0],
    patientPlanDetail.body.data.treatment_plan,
  ]) {
    assert.equal(item.start_date, "2026-10-31");
    assert.equal(item.end_date, null);
  }

  const createAppointment = await request(app)
    .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", token)
    .send({ appointment_date: "2026-10-31 23:59:59", purpose: "Near midnight" });
  assert.equal(createAppointment.status, 201);
  const appointment = createAppointment.body.data.appointment;
  assert.equal(appointment.appointment_date, "2026-10-31 23:59:59");

  const doctorAppointmentList = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", token);
  const doctorAppointmentDetail = await request(app)
    .get(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", token);
  const patientAppointmentList = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  const patientAppointmentDetail = await request(app)
    .get(`/api/patient/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  for (const response of [doctorAppointmentList, doctorAppointmentDetail, patientAppointmentList, patientAppointmentDetail]) {
    assert.equal(response.status, 200);
  }
  for (const item of [
    doctorAppointmentList.body.data.appointments[0],
    doctorAppointmentDetail.body.data.appointment,
    patientAppointmentList.body.data.appointments[0],
    patientAppointmentDetail.body.data.appointment,
  ]) {
    assert.equal(item.appointment_date, "2026-10-31 23:59:59");
  }

  const storedAppointment = await db.raw(
    "SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d %H:%i:%s') AS appointment_date FROM treatment_appointments WHERE id = ?",
    [appointment.id],
  );
  assert.deepEqual(storedAppointment[0][0], { appointment_date: "2026-10-31 23:59:59" });
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
      start_date: "2026-09-22",
      end_date: "2026-10-22",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Treatment Plan updated successfully");
  assert.equal(
    response.body.data.treatment_plan.title,
    "Updated Treatment Plan",
  );
  assert.equal(response.body.data.treatment_plan.status, "COMPLETED");
  assert.equal(response.body.data.treatment_plan.start_date, "2026-09-22");
  assert.equal(response.body.data.treatment_plan.end_date, "2026-10-22");
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

test("treatment plan date updates preserve appointments at inclusive boundaries and null end", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ start_date: "2026-10-01", end_date: "2026-10-31" });
  await insertTreatmentAppointment(plan.id, { appointment_date: "2026-10-01 00:00:00" });
  await insertTreatmentAppointment(plan.id, { appointment_date: "2026-10-31 23:59:59" });
  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ start_date: "2026-10-01", end_date: null });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.treatment_plan.end_date, null);
});

test("treatment plan date update rejects an existing out-of-range appointment and rolls back", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ start_date: "2026-10-01", end_date: "2026-10-31" });
  await insertTreatmentAppointment(plan.id, { appointment_date: "2026-10-31 23:59:59" });
  const response = await request(app)
    .patch(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({ end_date: "2026-10-30", title: "Should roll back" });
  assert.equal(response.status, 400);
  const stored = await db("treatment_plans").where({ id: plan.id }).first();
  const normalizeDatabaseDate = (value) => {
    if (value instanceof Date) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
    assert.ok(match, `Expected a SQL date or datetime, received ${value}`);
    return match[1];
  };
  assert.equal(normalizeDatabaseDate(stored.end_date), "2026-10-31");
  assert.equal(stored.title, plan.title);
  const storedAppointment = await db("treatment_appointments")
    .where({ treatment_plan_id: plan.id })
    .first();
  assert.equal(
    normalizeDatabaseDate(storedAppointment.appointment_date),
    "2026-10-31",
  );
});

test("appointment create and update accept inclusive plan boundaries and reject outside dates", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ start_date: "2026-10-01", end_date: "2026-10-31" });
  const token = `Bearer ${tokenFor(users.doctor)}`;
  const create = await request(app).post(`/api/doctor/treatment-plans/${plan.id}/appointments`).set("Authorization", token)
    .send({ appointment_date: "2026-10-01 00:00:00", purpose: "Boundary" });
  assert.equal(create.status, 201);
  assert.equal(create.body.data.appointment.appointment_date, "2026-10-01 00:00:00");
  const path = `/api/doctor/treatment-plans/${plan.id}/appointments/${create.body.data.appointment.id}`;
  const update = await request(app).patch(path).set("Authorization", token).send({ appointment_date: "2026-10-31 23:59:59" });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.appointment.appointment_date, "2026-10-31 23:59:59");
  const outside = await request(app).patch(path).set("Authorization", token).send({ appointment_date: "2026-11-01 00:00:00" });
  assert.equal(outside.status, 400);
  const stored = await db("treatment_appointments").where({ id: create.body.data.appointment.id }).first();
  const storedExact = await db.raw(
    "SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d %H:%i:%s') AS appointment_date FROM treatment_appointments WHERE id = ?",
    [stored.id],
  );
  assert.equal(storedExact[0][0].appointment_date, "2026-10-31 23:59:59");
});

test("appointment deletion removes the scoped resource", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan();
  const appointment = await insertTreatmentAppointment(plan.id);
  const response = await request(app).delete(`/api/doctor/treatment-plans/${plan.id}/appointments/${appointment.id}`)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);
  assert.equal(response.status, 200);
  assert.equal(await db("treatment_appointments").where({ id: appointment.id }).first(), undefined);
});

test("concurrency cleanup waits for server transaction after the client times out", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ start_date: "2026-10-01", end_date: "2026-10-31" });
  const reachedCreate = createDeferred();
  const insertedInTransaction = createDeferred();
  const releaseBeforeInsert = createDeferred();
  const releaseBeforeCommit = createDeferred();
  const originalCreate = treatmentAppointmentModel.create;
  const createObserver = observeNextApiOperation(
    "post",
    "/treatment-plans/:planId/appointments",
  );
  const createOperation = createObserver.expectNext();
  const restoreHooks = [
    () => { treatmentAppointmentModel.create = originalCreate; },
    () => createObserver.restore(),
  ];
  treatmentAppointmentModel.create = async function gatedCreate(...args) {
    reachedCreate.resolve();
    await waitForBounded(releaseBeforeInsert.promise, 15000, "test insert gate release");
    const inserted = await originalCreate.apply(this, args);
    insertedInTransaction.resolve();
    await waitForBounded(releaseBeforeCommit.promise, 15000, "test pre-commit gate release");
    return inserted;
  };

  const clientTimeoutMs = 1000;
  const pendingCreate = startBoundedRequest(
    request(app)
      .post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ appointment_date: "2026-10-31 10:00:00", purpose: "Timed out client" }),
    [createOperation],
    clientTimeoutMs,
  );
  const startedRequests = [pendingCreate];
  const cleanupWaiting = createDeferred();
  let cleanupPromise;
  let cleanupReturned = false;
  let failure;

  try {
    await waitForBounded(createOperation.startedSignal.promise, 5000, "appointment service start");
    await waitForBounded(reachedCreate.promise, 5000, "appointment model gate");
    const clientError = await waitForBounded(
      pendingCreate.promise.then(
        () => null,
        (error) => error,
      ),
      3000,
      "intentional client request timeout",
    );
    assert.ok(clientError instanceof Error, "the request must reject at its configured deadline");
    assert.equal(clientError.code, "ECONNABORTED");
    assert.equal(clientError.timeout, clientTimeoutMs);
    assert.equal(pendingCreate.requestHandle.timedout, true);
    assert.equal(createOperation.started, true);
    assert.equal(createOperation.completed, false);

    cleanupPromise = cleanupConcurrencyTest(
      {
        trx: null,
        startedRequests,
        releaseGates: [() => releaseBeforeInsert.resolve()],
        restoreHooks,
        onWaitingForServer: () => cleanupWaiting.resolve(),
      },
      null,
    ).then((result) => {
      cleanupReturned = true;
      return result;
    });
    await waitForBounded(cleanupWaiting.promise, 1000, "cleanup to wait for server operation");
    await waitForBounded(insertedInTransaction.promise, 5000, "uncommitted appointment insert");
    assert.equal(createOperation.completed, false);
    assert.equal(cleanupReturned, false, "cleanup must remain pending until the transaction completes");
    const visibleBeforeCommit = await db("treatment_appointments")
      .where({ treatment_plan_id: plan.id })
      .count("id as count")
      .first();
    assert.equal(Number(visibleBeforeCommit.count), 0, "the gated insert must remain uncommitted");

    releaseBeforeCommit.resolve();
    await waitForBounded(cleanupPromise, 12000, "cleanup after server transaction completion");
    assert.equal(createOperation.completed, true);
    assert.equal(cleanupReturned, true);
    const persistedAfterCleanup = await db("treatment_appointments")
      .where({ treatment_plan_id: plan.id })
      .first();
    assert.ok(persistedAfterCleanup, "the completed transaction should be visible when cleanup returns");
  } catch (error) {
    failure = error;
  } finally {
    releaseBeforeInsert.resolve();
    releaseBeforeCommit.resolve();
    if (!cleanupPromise) {
      cleanupPromise = cleanupConcurrencyTest(
        {
          trx: null,
          startedRequests,
          releaseGates: [],
          restoreHooks,
        },
        failure,
      );
    }
    try {
      await waitForBounded(cleanupPromise, 12000, "failure-path cleanup and server completion");
    } catch (cleanupError) {
      markUnsafeTestDatabaseState();
      if (failure) {
        failure.cleanupErrors = [...(failure.cleanupErrors || []), cleanupError];
      } else {
        failure = cleanupError;
      }
    }
    if (!createOperation.completed) {
      try {
        await waitForBounded(
          createOperation.completedSignal.promise,
          1000,
          "server completion after releasing failure-path gates",
        );
      } catch (completionError) {
        markUnsafeTestDatabaseState();
        if (failure) {
          failure.cleanupErrors = [...(failure.cleanupErrors || []), completionError];
        } else {
          failure = completionError;
        }
      }
    }
  }

  if (failure) throw failure;
});

test("plan date reduction serializes against appointment creation using separate connections", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ start_date: "2026-10-01", end_date: "2026-10-31" });
  const trx = await db.transaction();
  const requestConnection = createDeferred();
  const startedRequests = [];
  const createOperationObserver = observeNextApiOperation(
    "post",
    "/treatment-plans/:planId/appointments",
  );
  const createOperation = createOperationObserver.expectNext();
  const restoreHooks = [
    () => createOperationObserver.restore(),
    captureConnectionBeforeModelLock(
      treatmentPlanModel,
      "findByIdForUpdate",
      1,
      (connectionId) => requestConnection.resolve(connectionId),
    ),
  ];
  let failure;
  try {
    const blocker = await trx("treatment_plans")
      .select(db.raw("CONNECTION_ID() AS connection_id"))
      .where({ id: plan.id })
      .forUpdate()
      .first();
    const blockerConnectionId = Number(blocker.connection_id);
    const expectedLock = await getTreatmentPlanRecordLock(blockerConnectionId, plan.id);
    const pendingCreate = startBoundedRequest(request(app).post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ appointment_date: "2026-10-31 10:00:00", purpose: "Concurrent visit" }),
    [createOperation]);
    startedRequests.push(pendingCreate);
    const requestingConnectionId = await waitForBounded(
      requestConnection.promise,
      5000,
      "appointment API transaction connection",
    );
    await waitForTreatmentPlanLockWait({
      blockingConnectionId: blockerConnectionId,
      requestingConnectionId,
      expectedLock,
      planId: plan.id,
    });
    await waitForBounded(
      trx("treatment_plans").where({ id: plan.id }).update({ end_date: "2026-10-30" }),
      5000,
      "blocker plan-date update",
    );
    await waitForBounded(trx.commit(), 5000, "blocker transaction commit");
    const response = await waitForBounded(pendingCreate.promise, 8000, "appointment API response");
    assert.equal(response.status, 400);
    assert.equal(await db("treatment_appointments").where({ treatment_plan_id: plan.id }).count("id as count").first().then((row) => Number(row.count)), 0);
    const finalPlan = await db("treatment_plans").where({ id: plan.id }).first();
    assert.equal(databaseDateOnly(finalPlan.end_date), "2026-10-30");
  } catch (error) {
    failure = error;
  }

  failure = await cleanupConcurrencyTest(
    { trx, startedRequests, releaseGates: [], restoreHooks },
    failure,
  );
  if (failure) {
    try {
      await waitForBounded(
        db("treatment_appointments").where({ treatment_plan_id: plan.id }).del(),
        5000,
        "failed-test appointment cleanup",
      );
    } catch (cleanupError) {
      failure.cleanupErrors = [...(failure.cleanupErrors || []), cleanupError];
    }
    throw failure;
  }
});

test("appointment creation committed first makes a concurrent plan date reduction reject", async () => {
  await insertActiveAssignment();
  const plan = await insertTreatmentPlan({ start_date: "2026-10-01", end_date: "2026-10-31" });
  const createConnection = createDeferred();
  const updateConnection = createDeferred();
  const createReachedInsert = createDeferred();
  const releaseCreate = createDeferred();
  const startedRequests = [];
  const createOperationObserver = observeNextApiOperation(
    "post",
    "/treatment-plans/:planId/appointments",
  );
  const updateOperationObserver = observeNextApiOperation(
    "patch",
    "/patients/:patientId/treatment-plans/:planId",
  );
  const createOperation = createOperationObserver.expectNext();
  const updateOperation = updateOperationObserver.expectNext();
  const originalAppointmentCreate = treatmentAppointmentModel.create;
  treatmentAppointmentModel.create = async function gatedCreate(...args) {
    createReachedInsert.resolve();
    await waitForBounded(releaseCreate.promise, 9000, "appointment test gate release");
    return originalAppointmentCreate.apply(this, args);
  };
  const restoreHooks = [
    () => { treatmentAppointmentModel.create = originalAppointmentCreate; },
    () => updateOperationObserver.restore(),
    () => createOperationObserver.restore(),
    captureConnectionBeforeModelLock(
      treatmentPlanModel,
      "findByIdForUpdate",
      1,
      (connectionId) => createConnection.resolve(connectionId),
    ),
    captureConnectionBeforeModelLock(
      treatmentPlanModel,
      "findByIdAndPatientIdForUpdate",
      2,
      (connectionId) => updateConnection.resolve(connectionId),
    ),
  ];
  let failure;
  try {
    const pendingCreate = startBoundedRequest(request(app).post(`/api/doctor/treatment-plans/${plan.id}/appointments`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ appointment_date: "2026-10-31 10:00:00", purpose: "Concurrent visit" }),
    [createOperation]);
    startedRequests.push(pendingCreate);
    await waitForBounded(createReachedInsert.promise, 5000, "appointment request to acquire and validate the plan lock");
    const createConnectionId = await waitForBounded(createConnection.promise, 1000, "appointment API transaction connection");
    const expectedLock = await getTreatmentPlanRecordLock(createConnectionId, plan.id);

    const pendingReduction = startBoundedRequest(request(app)
      .patch(`/api/doctor/patients/${users.patientProfile.id}/treatment-plans/${plan.id}`)
      .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
      .send({ end_date: "2026-10-30" }),
    [updateOperation]);
    startedRequests.push(pendingReduction);
    const reductionConnectionId = await waitForBounded(
      updateConnection.promise,
      5000,
      "treatment plan reduction API transaction connection",
    );
    await waitForTreatmentPlanLockWait({
      blockingConnectionId: createConnectionId,
      requestingConnectionId: reductionConnectionId,
      expectedLock,
      planId: plan.id,
    });

    releaseCreate.resolve();
    const created = await waitForBounded(pendingCreate.promise, 8000, "appointment API response");
    const reduced = await waitForBounded(pendingReduction.promise, 8000, "treatment plan reduction API response");
    assert.equal(created.status, 201);
    assert.equal(reduced.status, 400);
    const finalPlan = await db("treatment_plans").where({ id: plan.id }).first();
    const appointment = await db("treatment_appointments").where({ id: created.body.data.appointment.id }).first();
    assert.equal(databaseDateOnly(finalPlan.start_date), "2026-10-01");
    assert.equal(databaseDateOnly(finalPlan.end_date), "2026-10-31");
    assert.deepEqual(
      {
        id: Number(appointment.id),
        treatment_plan_id: Number(appointment.treatment_plan_id),
        appointment_date: databaseDateTime(appointment.appointment_date),
        purpose: appointment.purpose,
        location: appointment.location,
        status: appointment.status,
        notes: appointment.notes,
      },
      {
        id: Number(created.body.data.appointment.id),
        treatment_plan_id: plan.id,
        appointment_date: "2026-10-31 10:00:00",
        purpose: "Concurrent visit",
        location: null,
        status: "SCHEDULED",
        notes: null,
      },
    );
  } catch (error) {
    failure = error;
  }

  failure = await cleanupConcurrencyTest(
    { trx: null, startedRequests, releaseGates: [() => releaseCreate.resolve()], restoreHooks },
    failure,
  );
  if (failure) {
    try {
      await waitForBounded(
        db("treatment_appointments").where({ treatment_plan_id: plan.id }).del(),
        5000,
        "failed-test appointment cleanup",
      );
    } catch (cleanupError) {
      failure.cleanupErrors = [...(failure.cleanupErrors || []), cleanupError];
    }
    throw failure;
  }
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
