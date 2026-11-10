const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertTreatmentPlan,
  insertTreatmentMedication,
  insertTreatmentAppointment,
  createSecondPatient,
  insertAssistanceRequest,
  REMINDER_COLUMNS,
  localDateTimeString,
  insertReminder,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Reminders
registerIntegrationHooks();

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
  const reminderService = require("../../src/services/reminderService");
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
  const reminderService = require("../../src/services/reminderService");
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
  const notificationModel = require("../../src/models/notificationModel");
  const reminderService = require("../../src/services/reminderService");
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
  const reminderService = require("../../src/services/reminderService");
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
  const notificationService = require("../../src/services/notificationService");
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
  const reminderWorker = require("../../src/workers/reminderWorker");
  assert.equal(reminderWorker.REMINDER_INTERVAL_MS, 60000);
  assert.equal(reminderWorker.startReminderWorker(), null);
  reminderWorker.stopReminderWorker();
});
