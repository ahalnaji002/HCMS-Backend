const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertMessagingAssignment,
  createMessagingPatient,
  createMessagingDoctor,
  insertMessage,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Patient-Doctor Messaging
registerIntegrationHooks();

test("Patient sends a message to an actively assigned Doctor with server-derived sender fields", async () => {
  await insertMessagingAssignment();

  const response = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({
      receiver_id: users.doctor.id,
      message_text: "  I need advice about my medication.  ",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.message.sender_id, users.patient.id);
  assert.equal(response.body.data.message.receiver_id, users.doctor.id);
  assert.equal(
    response.body.data.message.message_text,
    "I need advice about my medication.",
  );
  assert.equal(response.body.data.message.is_read, 0);
  assert.equal(response.body.data.message.read_at, null);
  assert.ok(response.body.data.message.sent_at);

  const stored = await db("messages")
    .where({ id: response.body.data.message.id })
    .first();
  assert.equal(stored.sender_id, users.patient.id);
  assert.equal(stored.receiver_id, users.doctor.id);
});

test("Doctor sends a message to an actively assigned Patient with authenticated identity", async () => {
  await insertMessagingAssignment();

  const response = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      receiver_id: users.patient.id,
      message_text: "Please continue the prescribed treatment.",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.message.sender_id, users.doctor.id);
  assert.equal(response.body.data.message.receiver_id, users.patient.id);
});

test("Messaging send requires the exact ACTIVE Doctor-Patient Assignment", async () => {
  const otherDoctor = await createMessagingDoctor("NO-PAIR");
  await insertMessagingAssignment();
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const wrongDoctor = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({
      receiver_id: otherDoctor.user.id,
      message_text: "This must be blocked",
    });

  await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    })
    .update({ status: "INACTIVE", ended_at: db.fn.now() });

  const inactive = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({
      receiver_id: users.doctor.id,
      message_text: "This must also be blocked",
    });

  assert.equal(wrongDoctor.status, 403);
  assert.equal(inactive.status, 403);
  assert.equal((await db("messages")).length, 0);
});

test("Doctor cannot message a Patient without their exact ACTIVE assignment", async () => {
  const otherPatient = await createMessagingPatient("NO-PAIR");
  await insertMessagingAssignment();

  const response = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({
      receiver_id: otherPatient.user.id,
      message_text: "This must be blocked",
    });

  assert.equal(response.status, 403);
  assert.equal((await db("messages")).length, 0);
});

test("Messaging rejects same-role recipients and nonexistent users", async () => {
  const otherPatient = await createMessagingPatient("SAME-ROLE");
  await insertMessagingAssignment();
  const authorization = `Bearer ${tokenFor(users.patient)}`;

  const sameRole = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({
      receiver_id: otherPatient.user.id,
      message_text: "Not allowed",
    });
  const missing = await request(app)
    .post("/api/messages")
    .set("Authorization", authorization)
    .send({ receiver_id: "999999999", message_text: "Not found" });

  assert.equal(sameRole.status, 403);
  assert.equal(missing.status, 404);
});

test("Message creation validates exact fields IDs and TEXT capacity", async () => {
  await insertMessagingAssignment();
  const authorization = `Bearer ${tokenFor(users.patient)}`;
  const send = (body) =>
    request(app)
      .post("/api/messages")
      .set("Authorization", authorization)
      .send(body);

  const missingText = await send({ receiver_id: users.doctor.id });
  const empty = await send({
    receiver_id: users.doctor.id,
    message_text: "   ",
  });
  const oversized = await send({
    receiver_id: users.doctor.id,
    message_text: "م".repeat(32768),
  });
  const protectedField = await send({
    receiver_id: users.doctor.id,
    message_text: "Hello",
    sender_id: users.admin.id,
  });
  const unsafeNumber = await send({
    receiver_id: Number.MAX_SAFE_INTEGER + 1,
    message_text: "Hello",
  });
  const outOfRange = await send({
    receiver_id: "18446744073709551616",
    message_text: "Hello",
  });
  const exactBoundaryText = "a".repeat(65535);

  assert.equal(Buffer.byteLength(exactBoundaryText, "utf8"), 65535);

  const exactBoundary = await send({
    receiver_id: users.doctor.id,
    message_text: exactBoundaryText,
  });

  for (const response of [
    missingText,
    empty,
    oversized,
    protectedField,
    unsafeNumber,
    outOfRange,
  ]) {
    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Validation failed");
  }
  assert.equal(protectedField.body.errors.sender_id, "sender_id is not allowed");
  assert.equal(exactBoundary.status, 201);

  const storedBoundary = await db("messages")
    .where({ id: exactBoundary.body.data.message.id })
    .first();
  assert.equal(Buffer.byteLength(storedBoundary.message_text, "utf8"), 65535);
  assert.equal((await db("messages")).length, 1);
});

test("Patient and Doctor list only their own conversation summaries newest-first", async () => {
  const otherPatient = await createMessagingPatient("LIST");
  const otherDoctor = await createMessagingDoctor("LIST");
  const olderPrimary = await insertMessage({
    message_text: "Older conversation",
    sent_at: "2026-09-25 10:00:00",
  });
  await db("messages").insert({
    sender_id: otherPatient.user.id,
    receiver_id: otherDoctor.user.id,
    message_text: "Unrelated conversation",
    sent_at: "2026-09-26 11:00:00",
  });
  const latestPrimary = await insertMessage({
    sender_id: users.doctor.id,
    receiver_id: users.patient.id,
    message_text: "Latest primary conversation message",
    sent_at: "2026-09-26 12:00:00",
  });
  const latestOther = await insertMessage({
    sender_id: users.patient.id,
    receiver_id: otherDoctor.user.id,
    message_text: "Latest other conversation message",
    sent_at: "2026-09-26 12:00:00",
  });

  assert.ok(latestOther.id > latestPrimary.id);
  assert.ok(
    await db("messages").where({ id: olderPrimary.id }).first(),
  );
  assert.ok(
    await db("messages").where({ id: latestPrimary.id }).first(),
  );
  assert.ok(await db("messages").where({ id: latestOther.id }).first());

  const patientResponse = await request(app)
    .get("/api/messages/conversations")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(patientResponse.status, 200);
  assert.deepEqual(
    patientResponse.body.data.conversations.map((conversation) => ({
      participant_id: conversation.participant.id,
      latest_message_id: conversation.last_message.id,
    })),
    [
      {
        participant_id: otherDoctor.user.id,
        latest_message_id: latestOther.id,
      },
      {
        participant_id: users.doctor.id,
        latest_message_id: latestPrimary.id,
      },
    ],
  );
  assert.equal(
    new Set(
      patientResponse.body.data.conversations.map(
        (conversation) => String(conversation.participant.id),
      ),
    ).size,
    2,
  );

  const doctorResponse = await request(app)
    .get("/api/messages/conversations")
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`);

  assert.equal(doctorResponse.status, 200);
  assert.equal(doctorResponse.body.data.conversations.length, 1);
  assert.equal(
    doctorResponse.body.data.conversations[0].participant.id,
    users.patient.id,
  );
  assert.equal(
    doctorResponse.body.data.conversations[0].last_message.id,
    latestPrimary.id,
  );
  assert.deepEqual(
    Object.keys(patientResponse.body.data.conversations[0].participant).sort(),
    ["full_name", "id", "role"],
  );
});

test("Conversation history is participant-scoped and deterministically chronological", async () => {
  const first = await insertMessage({
    message_text: "First",
    sent_at: "2026-09-26 09:00:00",
  });
  const tiedFirst = await insertMessage({
    sender_id: users.doctor.id,
    receiver_id: users.patient.id,
    message_text: "Second",
    sent_at: "2026-09-26 10:00:00",
  });
  const tiedSecond = await insertMessage({
    message_text: "Third",
    sent_at: "2026-09-26 10:00:00",
  });

  for (const [currentUser, otherUser] of [
    [users.patient, users.doctor],
    [users.doctor, users.patient],
  ]) {
    const response = await request(app)
      .get(`/api/messages/conversations/${otherUser.id}`)
      .set("Authorization", `Bearer ${tokenFor(currentUser)}`);

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.messages.map((message) => message.id),
      [first.id, tiedFirst.id, tiedSecond.id],
    );
  }
});

test("Unrelated Patients and Doctors cannot read another conversation", async () => {
  const otherPatient = await createMessagingPatient("HISTORY");
  const otherDoctor = await createMessagingDoctor("HISTORY");
  await insertMessage();

  const patientResponse = await request(app)
    .get(`/api/messages/conversations/${users.doctor.id}`)
    .set("Authorization", `Bearer ${tokenFor(otherPatient.user)}`);
  const doctorResponse = await request(app)
    .get(`/api/messages/conversations/${users.patient.id}`)
    .set("Authorization", `Bearer ${tokenFor(otherDoctor.user)}`);

  assert.equal(patientResponse.status, 403);
  assert.equal(doctorResponse.status, 403);
  assert.equal(patientResponse.body.message, "Conversation access forbidden");
});

test("Revoked assignment preserves history but blocks both directions of new messaging", async () => {
  const assignment = await insertMessagingAssignment();
  const firstSend = await request(app)
    .post("/api/messages")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({ receiver_id: users.doctor.id, message_text: "Historical message" });
  assert.equal(firstSend.status, 201);

  await db("doctor_patient_assignments")
    .where({ id: assignment.id })
    .update({ status: "INACTIVE", ended_at: db.fn.now() });

  const [patientHistory, doctorHistory, patientSend, doctorSend] =
    await Promise.all([
      request(app)
        .get(`/api/messages/conversations/${users.doctor.id}`)
        .set("Authorization", `Bearer ${tokenFor(users.patient)}`),
      request(app)
        .get(`/api/messages/conversations/${users.patient.id}`)
        .set("Authorization", `Bearer ${tokenFor(users.doctor)}`),
      request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
        .send({ receiver_id: users.doctor.id, message_text: "Blocked" }),
      request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
        .send({ receiver_id: users.patient.id, message_text: "Blocked" }),
    ]);

  assert.equal(patientHistory.status, 200);
  assert.equal(doctorHistory.status, 200);
  assert.equal(patientSend.status, 403);
  assert.equal(doctorSend.status, 403);
  assert.equal(patientHistory.body.data.messages.length, 1);
});

test("Message sending serializes safely with assignment deactivation", async () => {
  const assignment = await insertMessagingAssignment();
  const doctorModel = require("../../src/models/doctorModel");
  const originalFindByIdForUpdate = doctorModel.findByIdForUpdate;
  let signalDoctorLockAttempt;
  const doctorLockAttempted = new Promise((resolve) => {
    signalDoctorLockAttempt = resolve;
  });
  const revocationTrx = await db.transaction();
  let transactionCompleted = false;
  let sendResponse;

  try {
    doctorModel.findByIdForUpdate = async (...args) => {
      signalDoctorLockAttempt();
      return originalFindByIdForUpdate(...args);
    };

    await revocationTrx("doctors")
      .where({ id: users.doctorProfile.id })
      .forUpdate()
      .first();
    await revocationTrx("patients")
      .where({ id: users.patientProfile.id })
      .forUpdate()
      .first();
    await revocationTrx("doctor_patient_assignments")
      .where({ id: assignment.id })
      .forUpdate()
      .first();
    await revocationTrx("doctor_patient_assignments")
      .where({ id: assignment.id })
      .update({
        status: "INACTIVE",
        ended_at: revocationTrx.fn.now(),
        updated_at: revocationTrx.fn.now(),
      });

    const sendPromise = request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
      .send({
        receiver_id: users.doctor.id,
        message_text: "Concurrent assignment state check",
      })
      .then((response) => response);

    await doctorLockAttempted;
    await revocationTrx.commit();
    transactionCompleted = true;
    sendResponse = await sendPromise;
  } finally {
    doctorModel.findByIdForUpdate = originalFindByIdForUpdate;
    if (!transactionCompleted) {
      await revocationTrx.rollback();
    }
  }

  assert.equal(sendResponse.status, 403);

  const storedAssignment = await db("doctor_patient_assignments")
    .where({ id: assignment.id })
    .first();
  const storedMessages = await db("messages").where({
    sender_id: users.patient.id,
    receiver_id: users.doctor.id,
  });

  assert.equal(storedAssignment.status, "INACTIVE");
  assert.equal(storedMessages.length, 0);
});

test("Only the receiver marks a message read and the operation is idempotent", async () => {
  const message = await insertMessage();
  const unrelatedPatient = await createMessagingPatient("READ");
  const path = `/api/messages/${message.id}/read`;

  const senderAttempt = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`)
    .send({});
  const unrelatedAttempt = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(unrelatedPatient.user)}`)
    .send({});
  const unchangedMessage = await db("messages")
    .where({ id: message.id })
    .first();

  assert.equal(senderAttempt.status, 403);
  assert.equal(unrelatedAttempt.status, 403);
  assert.equal(unchangedMessage.is_read, 0);
  assert.equal(unchangedMessage.read_at, null);

  const first = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});
  const second = await request(app)
    .patch(path)
    .set("Authorization", `Bearer ${tokenFor(users.doctor)}`)
    .send({});

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.data.message.is_read, 1);
  assert.ok(first.body.data.message.read_at);
  assert.equal(
    new Date(second.body.data.message.read_at).getTime(),
    new Date(first.body.data.message.read_at).getTime(),
  );
});

test("Message history and read routes validate scope identifiers and bodies", async () => {
  const message = await insertMessage();
  const authorization = `Bearer ${tokenFor(users.doctor)}`;

  const invalidUser = await request(app)
    .get("/api/messages/conversations/not-an-id")
    .set("Authorization", authorization);
  const outOfRangeUser = await request(app)
    .get("/api/messages/conversations/18446744073709551616")
    .set("Authorization", authorization);
  const invalidMessage = await request(app)
    .patch("/api/messages/not-an-id/read")
    .set("Authorization", authorization)
    .send({});
  const unknownField = await request(app)
    .patch(`/api/messages/${message.id}/read`)
    .set("Authorization", authorization)
    .send({ is_read: true });
  const missing = await request(app)
    .patch("/api/messages/999999999/read")
    .set("Authorization", authorization)
    .send({});

  assert.equal(invalidUser.status, 400);
  assert.equal(outOfRangeUser.status, 400);
  assert.equal(invalidMessage.status, 400);
  assert.equal(unknownField.status, 400);
  assert.equal(missing.status, 404);
});

test("Messaging routes allow only authenticated Patient and Doctor accounts", async () => {
  const message = await insertMessage();

  for (const path of [
    ["post", "/api/messages"],
    ["get", "/api/messages/conversations"],
    ["get", `/api/messages/conversations/${users.doctor.id}`],
    ["patch", `/api/messages/${message.id}/read`],
  ]) {
    const unauthenticated = await request(app)[path[0]](path[1]);
    assert.equal(unauthenticated.status, 401);

    for (const wrongRole of [users.ngo, users.admin]) {
      const response = await request(app)
        [path[0]](path[1])
        .set("Authorization", `Bearer ${tokenFor(wrongRole)}`)
        .send(
          path[0] === "post"
            ? { receiver_id: users.doctor.id, message_text: "Blocked" }
            : path[0] === "patch"
              ? {}
              : undefined,
        );
      assert.equal(response.status, 403);
    }
  }
});
