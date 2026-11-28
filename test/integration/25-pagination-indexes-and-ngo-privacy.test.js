const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertActiveAssignment,
  insertAssistanceRequest,
  getPrimaryNgoProfile,
  insertNotification,
  createSecondPatient,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Pre-release C2: pagination (BE-06), query indexes (BE-05), and no patient
// or doctor ids in NGO responses (BE-14).
registerIntegrationHooks();

function bearer(user) {
  return `Bearer ${tokenFor(user)}`;
}

async function insertMessage(senderId, receiverId, text, sentAt) {
  const [id] = await db("messages").insert({
    sender_id: senderId,
    receiver_id: receiverId,
    message_text: text,
    is_read: false,
    sent_at: sentAt,
  });
  return id;
}

test("notifications are paged newest first with page metadata", async () => {
  for (let index = 1; index <= 5; index += 1) {
    await insertNotification(users.patient.id, { title: `Notification ${index}` });
  }

  const first = await request(app)
    .get("/api/notifications?limit=2")
    .set("Authorization", bearer(users.patient));

  assert.equal(first.status, 200);
  assert.deepEqual(
    first.body.data.notifications.map((item) => item.title),
    ["Notification 5", "Notification 4"],
  );
  assert.equal(first.body.data.page, 1);
  assert.equal(first.body.data.limit, 2);
  assert.equal(first.body.data.total, 5);
  assert.equal(first.body.data.total_pages, 3);

  const last = await request(app)
    .get("/api/notifications?limit=2&page=3")
    .set("Authorization", bearer(users.patient));

  assert.equal(last.status, 200);
  assert.deepEqual(
    last.body.data.notifications.map((item) => item.title),
    ["Notification 1"],
  );
});

test("notifications default to 50 per page", async () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({
    user_id: users.doctor.id,
    title: `Bulk ${index}`,
    message: "Bulk notification",
    type: "TREATMENT_PLAN",
    is_read: false,
  }));
  await db("notifications").insert(rows);

  const response = await request(app)
    .get("/api/notifications")
    .set("Authorization", bearer(users.doctor));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.notifications.length, 50);
  assert.equal(response.body.data.limit, 50);
  assert.equal(response.body.data.total, 51);
  assert.equal(response.body.data.total_pages, 2);
});

test("invalid page or limit values are rejected", async () => {
  for (const query of ["page=0", "page=abc", "limit=0", "limit=101", "limit=1.5", "page=-1"]) {
    const response = await request(app)
      .get(`/api/notifications?${query}`)
      .set("Authorization", bearer(users.patient));

    assert.equal(response.status, 400, query);
    assert.equal(response.body.message, "Validation failed");
  }
});

test("conversation history pages from the newest messages, each page oldest first", async () => {
  await insertActiveAssignment();
  for (let index = 1; index <= 5; index += 1) {
    await insertMessage(
      index % 2 ? users.patient.id : users.doctor.id,
      index % 2 ? users.doctor.id : users.patient.id,
      `Message ${index}`,
      `2026-11-0${index} 10:00:00`,
    );
  }

  const newest = await request(app)
    .get(`/api/messages/conversations/${users.doctor.id}?limit=2`)
    .set("Authorization", bearer(users.patient));

  assert.equal(newest.status, 200);
  assert.deepEqual(
    newest.body.data.messages.map((message) => message.message_text),
    ["Message 4", "Message 5"],
  );
  assert.equal(newest.body.data.total, 5);
  assert.equal(newest.body.data.total_pages, 3);

  const older = await request(app)
    .get(`/api/messages/conversations/${users.doctor.id}?limit=2&page=2`)
    .set("Authorization", bearer(users.patient));

  assert.deepEqual(
    older.body.data.messages.map((message) => message.message_text),
    ["Message 2", "Message 3"],
  );

  // A page past the end of a real conversation is empty, not forbidden.
  const pastEnd = await request(app)
    .get(`/api/messages/conversations/${users.doctor.id}?limit=2&page=9`)
    .set("Authorization", bearer(users.patient));

  assert.equal(pastEnd.status, 200);
  assert.deepEqual(pastEnd.body.data.messages, []);
});

test("conversation list returns the latest message per partner, newest partner first", async () => {
  const secondPatient = await createSecondPatient();
  const secondPatientUserId = secondPatient.user.id;

  await insertMessage(users.patient.id, users.doctor.id, "patient old", "2026-11-01 09:00:00");
  await insertMessage(users.doctor.id, users.patient.id, "patient latest", "2026-11-03 09:00:00");
  await insertMessage(secondPatientUserId, users.doctor.id, "second latest", "2026-11-02 09:00:00");
  await insertMessage(users.doctor.id, secondPatientUserId, "second old", "2026-11-01 08:00:00");

  const response = await request(app)
    .get("/api/messages/conversations")
    .set("Authorization", bearer(users.doctor));

  assert.equal(response.status, 200);
  const conversations = response.body.data.conversations;
  assert.equal(conversations.length, 2);
  assert.deepEqual(
    conversations.map((item) => [item.participant.id, item.last_message.message_text]),
    [
      [users.patient.id, "patient latest"],
      [secondPatientUserId, "second latest"],
    ],
  );
  assert.deepEqual(Object.keys(conversations[0].participant).sort(), ["full_name", "id", "role"]);
  assert.deepEqual(
    Object.keys(conversations[0].last_message).sort(),
    ["created_at", "id", "is_read", "message_text", "read_at", "receiver_id", "sender_id", "sent_at"],
  );
});

test("admin lists keep the full list without paging and page on request", async () => {
  for (let index = 0; index < 3; index += 1) {
    await insertAssistanceRequest({ request_type: `Type ${index}` });
  }

  const full = await request(app)
    .get("/api/admin/assistance-requests")
    .set("Authorization", bearer(users.admin));

  assert.equal(full.status, 200);
  assert.equal(full.body.data.assistance_requests.length, 3);
  assert.deepEqual(Object.keys(full.body.data), ["assistance_requests"]);

  const paged = await request(app)
    .get("/api/admin/assistance-requests?limit=2")
    .set("Authorization", bearer(users.admin));

  assert.equal(paged.status, 200);
  assert.equal(paged.body.data.assistance_requests.length, 2);
  assert.equal(paged.body.data.total, 3);
  assert.equal(paged.body.data.total_pages, 2);

  for (const path of [
    "/api/admin/emergency-alerts",
    "/api/admin/patient-intakes",
    "/api/admin/doctor-patient-assignments",
  ]) {
    const response = await request(app)
      .get(`${path}?page=1&limit=5`)
      .set("Authorization", bearer(users.admin));

    assert.equal(response.status, 200, path);
    assert.equal(response.body.data.page, 1, path);
    assert.equal(response.body.data.limit, 5, path);
    assert.equal(typeof response.body.data.total, "number", path);

    const invalid = await request(app)
      .get(`${path}?limit=500`)
      .set("Authorization", bearer(users.admin));
    assert.equal(invalid.status, 400, path);
  }
});

test("NGO responses do not include patient or doctor ids", async () => {
  const ngo = await getPrimaryNgoProfile();
  const assistanceRequest = await insertAssistanceRequest({
    ngo_id: ngo.id,
    status: "UNDER_REVIEW",
  });
  const ngoAuth = bearer(users.ngo);

  const list = await request(app)
    .get("/api/ngo/assistance-requests")
    .set("Authorization", ngoAuth);
  const detail = await request(app)
    .get(`/api/ngo/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", ngoAuth);
  const updated = await request(app)
    .patch(`/api/ngo/assistance-requests/${assistanceRequest.id}/status`)
    .set("Authorization", ngoAuth)
    .send({ status: "APPROVED" });

  assert.equal(list.status, 200);
  assert.equal(detail.status, 200);
  assert.equal(updated.status, 200);

  for (const item of [
    list.body.data.assistance_requests[0],
    detail.body.data.assistance_request,
    updated.body.data.assistance_request,
  ]) {
    assert.equal(item.id, assistanceRequest.id);
    assert.equal("patient_id" in item, false);
    assert.equal("doctor_id" in item, false);
    assert.equal(item.ngo_id, ngo.id);
  }

  // The admin view still has them.
  const admin = await request(app)
    .get(`/api/admin/assistance-requests/${assistanceRequest.id}`)
    .set("Authorization", bearer(users.admin));
  assert.equal(admin.body.data.assistance_request.patient_id, users.patientProfile.id);
});

test("query indexes exist", async () => {
  const expected = {
    reminders: ["reminders_status_remind_at_index"],
    notifications: [
      "notifications_user_id_is_read_index",
      "notifications_user_id_created_at_index",
    ],
    messages: [
      "messages_sender_receiver_sent_at_index",
      "messages_receiver_sender_sent_at_index",
    ],
    emergency_alerts: ["emergency_alerts_status_index"],
    assistance_requests: ["assistance_requests_status_index"],
    activity_logs: ["activity_logs_created_at_index"],
    users: ["users_role_account_status_index"],
  };

  for (const [table, names] of Object.entries(expected)) {
    const [rows] = await db.raw(`SHOW INDEX FROM \`${table}\``);
    const present = new Set(rows.map((row) => row.Key_name));
    for (const name of names) {
      assert.ok(present.has(name), `${table}.${name}`);
    }
  }
});
