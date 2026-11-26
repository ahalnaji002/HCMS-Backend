const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  createUser,
  tokenFor,
  insertAssistanceRequest,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// User and Organization Management (FR-10.1, FR-10.2)
registerIntegrationHooks();

const asAdmin = () => `Bearer ${tokenFor(users.admin)}`;

async function ngoProfile() {
  return db("ngos").where({ user_id: users.ngo.id }).first();
}

test("Admin lists users newest first without password hashes", async () => {
  const response = await request(app)
    .get("/api/admin/users")
    .set("Authorization", asAdmin());

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  const { users: listed, page, limit, total, total_pages: totalPages } = response.body.data;
  assert.equal(page, 1);
  assert.equal(limit, 20);
  assert.equal(total, 4);
  assert.equal(totalPages, 1);
  assert.deepEqual(
    listed.map((user) => user.email).sort(),
    [users.admin, users.doctor, users.ngo, users.patient].map((user) => user.email).sort(),
  );
  for (const user of listed) {
    assert.equal("password_hash" in user, false);
  }
});

test("Admin filters users by role, account status, and search, with pagination", async () => {
  await createUser({ fullName: "Suspended Patient", email: "suspended.patient@test.local", role: "PATIENT", accountStatus: "SUSPENDED" });
  await createUser({ fullName: "Second Patient 50%", email: "second.patient@test.local", role: "PATIENT", phone: "0599999999" });

  const get = (query) => request(app).get(`/api/admin/users?${query}`).set("Authorization", asAdmin());

  const byRole = await get("role=PATIENT");
  assert.equal(byRole.body.data.total, 3);
  assert.ok(byRole.body.data.users.every((user) => user.role === "PATIENT"));

  const byStatus = await get("account_status=SUSPENDED");
  assert.deepEqual(byStatus.body.data.users.map((user) => user.email), ["suspended.patient@test.local"]);

  const byName = await get("search=second");
  assert.deepEqual(byName.body.data.users.map((user) => user.email), ["second.patient@test.local"]);

  const byPhone = await get("search=0599999");
  assert.deepEqual(byPhone.body.data.users.map((user) => user.email), ["second.patient@test.local"]);

  // LIKE wildcards are matched literally.
  const literalPercent = await get(`search=${encodeURIComponent("50%")}`);
  assert.deepEqual(literalPercent.body.data.users.map((user) => user.email), ["second.patient@test.local"]);
  const underscore = await get("search=_");
  assert.equal(underscore.body.data.total, 0);

  const paged = await get("role=PATIENT&limit=2&page=2");
  assert.equal(paged.body.data.users.length, 1);
  assert.equal(paged.body.data.total_pages, 2);
});

test("User list rejects invalid query parameters", async () => {
  for (const query of [
    "role=SUPERUSER",
    "account_status=DELETED",
    "page=0",
    "limit=101",
    "limit=abc",
    `search=${"x".repeat(101)}`,
    "unknown=1",
  ]) {
    const response = await request(app)
      .get(`/api/admin/users?${query}`)
      .set("Authorization", asAdmin());
    assert.equal(response.status, 400, query);
    assert.equal(response.body.message, "Validation failed");
  }
});

test("Admin deactivates and re-activates a user, logging both changes", async () => {
  const deactivate = await request(app)
    .patch(`/api/admin/users/${users.patient.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "SUSPENDED" });

  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.body.data.user.account_status, "SUSPENDED");
  assert.equal("password_hash" in deactivate.body.data.user, false);

  // The existing token stops working on the next request.
  const blocked = await request(app)
    .get("/api/patient/emergency-alerts")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);
  assert.equal(blocked.status, 403);

  const activate = await request(app)
    .patch(`/api/admin/users/${users.patient.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "ACTIVE" });
  assert.equal(activate.status, 200);
  assert.equal(activate.body.data.user.account_status, "ACTIVE");

  const logs = await db("activity_logs")
    .where({ entity_type: "USER", entity_id: users.patient.id })
    .orderBy("id", "asc");
  assert.deepEqual(logs.map((log) => log.action), ["DEACTIVATE_USER", "ACTIVATE_USER"]);
  assert.ok(logs.every((log) => Number(log.user_id) === users.admin.id));
  assert.equal(logs[0].description, `User #${users.patient.id} (PATIENT) deactivated.`);

  const listed = await request(app)
    .get("/api/admin/activity-logs?entity_type=USER&action=DEACTIVATE_USER")
    .set("Authorization", asAdmin());
  assert.equal(listed.status, 200);
});

test("Admin cannot change own account or deactivate the last active administrator", async () => {
  const self = await request(app)
    .patch(`/api/admin/users/${users.admin.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "SUSPENDED" });
  assert.equal(self.status, 409);
  assert.equal(self.body.message, "You cannot change the status of your own account");

  const secondAdmin = await createUser({ fullName: "Second Admin", email: "second.admin@test.local", role: "ADMIN" });
  const allowed = await request(app)
    .patch(`/api/admin/users/${secondAdmin.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "SUSPENDED" });
  assert.equal(allowed.status, 200);

  const stored = await db("users").where({ id: users.admin.id }).first();
  assert.equal(stored.account_status, "ACTIVE");
});

test("Concurrent deactivation of the two remaining administrators leaves one active", async () => {
  const secondAdmin = await createUser({ fullName: "Second Admin", email: "second.admin@test.local", role: "ADMIN" });

  const [first, second] = await Promise.all([
    request(app)
      .patch(`/api/admin/users/${secondAdmin.id}/status`)
      .set("Authorization", asAdmin())
      .send({ account_status: "SUSPENDED" }),
    request(app)
      .patch(`/api/admin/users/${users.admin.id}/status`)
      .set("Authorization", `Bearer ${tokenFor(secondAdmin)}`)
      .send({ account_status: "SUSPENDED" }),
  ]);

  // Requests queue on the admin row locks: one wins, the other sees one
  // active administrator left (409) instead of deadlocking (500).
  assert.deepEqual([first.status, second.status].sort((a, b) => a - b), [200, 409]);
  const active = await db("users").where({ role: "ADMIN", account_status: "ACTIVE" }).count({ total: "id" }).first();
  assert.equal(Number(active.total), 1);
});

test("Applicants awaiting approval are not activated through user management", async () => {
  const applicant = await createUser({ fullName: "Pending Doctor", email: "pending.doctor@test.local", role: "DOCTOR", accountStatus: "INACTIVE" });

  const activate = await request(app)
    .patch(`/api/admin/users/${applicant.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "ACTIVE" });
  assert.equal(activate.status, 409);
  assert.equal(activate.body.message, "Accounts awaiting approval are activated through Join Requests");

  const suspend = await request(app)
    .patch(`/api/admin/users/${applicant.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "SUSPENDED" });
  assert.equal(suspend.status, 409);

  const stored = await db("users").where({ id: applicant.id }).first();
  assert.equal(stored.account_status, "INACTIVE");
});

test("Status update rejects unchanged status, missing users, and invalid input", async () => {
  const unchanged = await request(app)
    .patch(`/api/admin/users/${users.patient.id}/status`)
    .set("Authorization", asAdmin())
    .send({ account_status: "ACTIVE" });
  assert.equal(unchanged.status, 409);
  assert.equal(unchanged.body.message, "User account is already ACTIVE");

  const missing = await request(app)
    .patch("/api/admin/users/999999999/status")
    .set("Authorization", asAdmin())
    .send({ account_status: "SUSPENDED" });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, "User not found");

  for (const [userId, body] of [
    ["abc", { account_status: "SUSPENDED" }],
    ["0", { account_status: "SUSPENDED" }],
    [String(users.patient.id), {}],
    [String(users.patient.id), { account_status: "INACTIVE" }],
    [String(users.patient.id), { account_status: "SUSPENDED", role: "ADMIN" }],
  ]) {
    const response = await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set("Authorization", asAdmin())
      .send(body);
    assert.equal(response.status, 400, JSON.stringify([userId, body]));
  }

  assert.equal(await db("activity_logs").where({ entity_type: "USER" }).count({ total: "id" }).first().then((row) => Number(row.total)), 0);
});

test("Admin lists NGOs with account status and assigned request counts", async () => {
  const ngo = await ngoProfile();
  await insertAssistanceRequest({ ngo_id: ngo.id, status: "UNDER_REVIEW" });
  await insertAssistanceRequest({ ngo_id: ngo.id, status: "COMPLETED" });
  await insertAssistanceRequest({ ngo_id: ngo.id, status: "REJECTED" });
  await insertAssistanceRequest();

  const otherUser = await createUser({ fullName: "Other NGO User", email: "other.ngo@test.local", role: "NGO", accountStatus: "SUSPENDED" });
  await db("ngos").insert({ user_id: otherUser.id, organization_name: "Aid Without Requests", registration_number: "OTHER-NGO-1" });

  const response = await request(app)
    .get("/api/admin/ngos")
    .set("Authorization", asAdmin());

  assert.equal(response.status, 200);
  const ngos = response.body.data.ngos;
  assert.deepEqual(ngos.map((item) => item.organization_name), ["Aid Without Requests", "Authorization Test NGO"]);

  const [quiet, busy] = ngos;
  assert.equal(quiet.account_status, "SUSPENDED");
  assert.equal(quiet.assigned_requests, 0);
  assert.equal(quiet.open_requests, 0);
  assert.equal(busy.account_status, "ACTIVE");
  assert.equal(busy.email, users.ngo.email);
  assert.equal(busy.contact_phone, "0592222222");
  assert.equal(busy.assigned_requests, 3);
  assert.equal(busy.open_requests, 1);
  assert.equal(busy.completed_requests, 1);

  const filtered = await request(app)
    .get("/api/admin/ngos?account_status=SUSPENDED")
    .set("Authorization", asAdmin());
  assert.deepEqual(filtered.body.data.ngos.map((item) => item.organization_name), ["Aid Without Requests"]);

  const searched = await request(app)
    .get("/api/admin/ngos?search=AUTH-NGO")
    .set("Authorization", asAdmin());
  assert.deepEqual(searched.body.data.ngos.map((item) => item.organization_name), ["Authorization Test NGO"]);

  const invalid = await request(app)
    .get("/api/admin/ngos?role=NGO")
    .set("Authorization", asAdmin());
  assert.equal(invalid.status, 400);
});

test("User and NGO management endpoints require an Admin", async () => {
  for (const [method, path] of [
    ["get", "/api/admin/users"],
    ["patch", `/api/admin/users/${users.patient.id}/status`],
    ["get", "/api/admin/ngos"],
  ]) {
    const responses = await Promise.all([
      request(app)[method](path).send({ account_status: "SUSPENDED" }),
      ...[users.patient, users.doctor, users.ngo].map((user) =>
        request(app)[method](path).set("Authorization", `Bearer ${tokenFor(user)}`).send({ account_status: "SUSPENDED" })),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [401, 403, 403, 403], path);
  }

  const stored = await db("users").where({ id: users.patient.id }).first();
  assert.equal(stored.account_status, "ACTIVE");
});
