const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  createUser,
  tokenFor,
  SYSTEM_SETTING_COLUMNS,
  seedSystemSettings,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// System Settings
registerIntegrationHooks();

test("System Setting endpoints require ADMIN authentication", async () => {
  await seedSystemSettings();
  const paths = [
    ["get", "/api/admin/settings", undefined],
    ["get", "/api/admin/settings/system_name", undefined],
    ["patch", "/api/admin/settings/system_name", { setting_value: "HCMS 2" }],
  ];

  for (const [method, path, body] of paths) {
    let unauthenticated = request(app)[method](path);
    if (body) unauthenticated = unauthenticated.send(body);
    assert.equal((await unauthenticated).status, 401);

    for (const currentUser of [users.patient, users.doctor, users.ngo]) {
      let forbidden = request(app)
        [method](path)
        .set("Authorization", `Bearer ${tokenFor(currentUser)}`);
      if (body) forbidden = forbidden.send(body);
      assert.equal((await forbidden).status, 403);
    }

    let admin = request(app)
      [method](path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`);
    if (body) admin = admin.send(body);
    assert.equal((await admin).status, 200);
  }
});

test("Admin lists only approved System Settings with safe ordered fields", async () => {
  await seedSystemSettings();
  await db("system_settings").insert({
    setting_key: "jwt_secret",
    setting_value: "must-not-leak",
    description: "Unapproved row",
  });

  const response = await request(app)
    .get("/api/admin/settings")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.settings.map((setting) => setting.setting_key),
    ["support_email", "support_phone", "system_name"],
  );
  for (const setting of response.body.data.settings) {
    assert.deepEqual(Object.keys(setting).sort(), SYSTEM_SETTING_COLUMNS);
  }
  assert.equal(JSON.stringify(response.body).includes("must-not-leak"), false);
});

test("Admin reads approved System Settings but cannot discover unapproved rows", async () => {
  await seedSystemSettings();
  await db("system_settings").insert({
    setting_key: "private_token",
    setting_value: "hidden",
    description: "Unapproved row",
  });
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  for (const key of ["system_name", "support_email", "support_phone"]) {
    const response = await request(app)
      .get(`/api/admin/settings/${key}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.setting.setting_key, key);
    assert.deepEqual(
      Object.keys(response.body.data.setting).sort(),
      SYSTEM_SETTING_COLUMNS,
    );
  }

  for (const key of ["unknown", "private_token"]) {
    const response = await request(app)
      .get(`/api/admin/settings/${key}`)
      .set("Authorization", authorization);
    assert.equal(response.status, 404);
  }
});

test("System Setting value validation follows the approved catalog", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const update = (key, value) =>
    request(app)
      .patch(`/api/admin/settings/${key}`)
      .set("Authorization", authorization)
      .send({ setting_value: value });

  const systemName = await update("system_name", "  HCMS Portal  ");
  assert.equal(systemName.status, 200);
  assert.equal(systemName.body.data.setting.setting_value, "HCMS Portal");
  assert.equal(
    (await db("system_settings").where({ setting_key: "system_name" }).first())
      .setting_value,
    "HCMS Portal",
  );
  const hundredUnicodeCharacters = "😀".repeat(100);
  const exactSystemNameBoundary = await update(
    "system_name",
    hundredUnicodeCharacters,
  );
  assert.equal(exactSystemNameBoundary.status, 200);
  assert.equal(
    exactSystemNameBoundary.body.data.setting.setting_value,
    hundredUnicodeCharacters,
  );
  for (const value of [
    null,
    "",
    "   ",
    "😀".repeat(101),
    42,
    true,
    {},
    [],
  ]) {
    assert.equal((await update("system_name", value)).status, 400);
  }

  const email = await update("support_email", "  support@example.com  ");
  assert.equal(email.status, 200);
  assert.equal(email.body.data.setting.setting_value, "support@example.com");
  const exactEmailBoundary = `${"😀"}${"a".repeat(242)}@example.com`;
  assert.equal(Array.from(exactEmailBoundary).length, 255);
  const boundaryEmail = await update("support_email", exactEmailBoundary);
  assert.equal(boundaryEmail.status, 200);
  assert.equal(
    boundaryEmail.body.data.setting.setting_value,
    exactEmailBoundary,
  );
  assert.equal((await update("support_email", null)).status, 200);
  for (const value of [
    "",
    "   ",
    "invalid-email",
    `${"a".repeat(244)}@example.com`,
    42,
    true,
    {},
    [],
  ]) {
    assert.equal((await update("support_email", value)).status, 400);
  }

  const phone059 = await update("support_phone", "  0591234567  ");
  assert.equal(phone059.status, 200);
  assert.equal(phone059.body.data.setting.setting_value, "0591234567");
  assert.equal((await update("support_phone", "0561234567")).status, 200);
  assert.equal((await update("support_phone", null)).status, 200);
  for (const value of [
    "0581234567",
    "059123456",
    "05912345678",
    "05912345ab",
    "059 1234567",
    "059-1234567",
    "",
    "   ",
    591234567,
    true,
    {},
    [],
  ]) {
    assert.equal((await update("support_phone", value)).status, 400);
  }
});

test("System Setting PATCH rejects protected unknown and empty fields", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const rejectedBodies = [
    {},
    { id: 1, setting_value: "HCMS" },
    { setting_key: "system_name", setting_value: "HCMS" },
    { description: "Changed", setting_value: "HCMS" },
    { updated_by_admin_id: users.admin.id, setting_value: "HCMS" },
    { created_at: "2026-01-01", setting_value: "HCMS" },
    { updated_at: "2026-01-01", setting_value: "HCMS" },
    { unknown: true, setting_value: "HCMS" },
  ];

  for (const body of rejectedBodies) {
    const response = await request(app)
      .patch("/api/admin/settings/system_name")
      .set("Authorization", authorization)
      .send(body);
    assert.equal(response.status, 400);
  }
});

test("System Setting PATCH never creates unknown or missing catalog rows", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;

  const unknown = await request(app)
    .patch("/api/admin/settings/arbitrary_key")
    .set("Authorization", authorization)
    .send({ setting_value: "value" });
  assert.equal(unknown.status, 404);
  assert.equal(
    await db("system_settings").where({ setting_key: "arbitrary_key" }).first(),
    undefined,
  );

  await db("system_settings").where({ setting_key: "support_email" }).del();
  const missing = await request(app)
    .patch("/api/admin/settings/support_email")
    .set("Authorization", authorization)
    .send({ setting_value: "support@example.com" });
  assert.equal(missing.status, 404);
  assert.equal(
    await db("system_settings").where({ setting_key: "support_email" }).first(),
    undefined,
  );
});

test("real System Setting update refreshes metadata and creates one safe Activity Log", async () => {
  await seedSystemSettings();
  await db("system_settings").where({ setting_key: "support_email" }).update({
    updated_at: "2026-01-01 00:00:00",
  });
  const before = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  const sensitiveValue = "private-support@example.com";

  const response = await request(app)
    .patch("/api/admin/settings/support_email")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ setting_value: sensitiveValue });
  assert.equal(response.status, 200);

  const stored = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  assert.equal(stored.setting_value, sensitiveValue);
  assert.equal(String(stored.updated_by_admin_id), String(users.admin.id));
  assert.ok(stored.updated_at.getTime() > before.updated_at.getTime());
  assert.deepEqual(
    Object.keys(response.body.data.setting).sort(),
    SYSTEM_SETTING_COLUMNS,
  );

  const logs = await db("activity_logs").where({
    action: "UPDATE_SYSTEM_SETTING",
    entity_type: "SYSTEM_SETTING",
    entity_id: stored.id,
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].description, `System Setting #${stored.id} updated`);
  assert.equal(String(logs[0].user_id), String(users.admin.id));
  assert.ok(["127.0.0.1", "::ffff:127.0.0.1"].includes(logs[0].ip_address));
  const serializedLog = JSON.stringify(logs[0]);
  assert.equal(serializedLog.includes("support_email"), false);
  assert.equal(serializedLog.includes(sensitiveValue), false);
});

test("same-value System Setting updates are successful no-ops", async () => {
  await seedSystemSettings();
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const beforeName = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();

  const sameName = await request(app)
    .patch("/api/admin/settings/system_name")
    .set("Authorization", authorization)
    .send({ setting_value: "  HCMS  " });
  assert.equal(sameName.status, 200);
  assert.equal(sameName.body.data.setting.setting_value, "HCMS");

  const afterName = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.equal(afterName.setting_value, beforeName.setting_value);
  assert.equal(afterName.updated_by_admin_id, beforeName.updated_by_admin_id);
  assert.equal(afterName.updated_at.getTime(), beforeName.updated_at.getTime());

  const beforeEmail = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  const sameNull = await request(app)
    .patch("/api/admin/settings/support_email")
    .set("Authorization", authorization)
    .send({ setting_value: null });
  assert.equal(sameNull.status, 200);
  const afterEmail = await db("system_settings")
    .where({ setting_key: "support_email" })
    .first();
  assert.equal(afterEmail.setting_value, null);
  assert.equal(afterEmail.updated_by_admin_id, beforeEmail.updated_by_admin_id);
  assert.equal(afterEmail.updated_at.getTime(), beforeEmail.updated_at.getTime());
  assert.equal((await db("activity_logs")).length, 0);
});

test("Activity Log failure rolls back a real System Setting update", async () => {
  await seedSystemSettings();
  const activityLogModel = require("../../src/models/activityLogModel");
  const originalCreate = activityLogModel.create;
  const before = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();

  let response;
  try {
    activityLogModel.create = async () => {
      throw new Error("Injected System Setting Activity Log failure");
    };
    response = await request(app)
      .patch("/api/admin/settings/system_name")
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ setting_value: "Changed Name" });
  } finally {
    activityLogModel.create = originalCreate;
  }

  assert.equal(response.status, 500);
  const afterFailure = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.equal(afterFailure.setting_value, before.setting_value);
  assert.equal(afterFailure.updated_by_admin_id, before.updated_by_admin_id);
  assert.equal(afterFailure.updated_at.getTime(), before.updated_at.getTime());
  assert.equal((await db("activity_logs")).length, 0);
});

test("concurrent same-value System Setting updates commit exactly one change log", async () => {
  await seedSystemSettings();
  await db("system_settings").where({ setting_key: "system_name" }).update({
    updated_at: "2026-01-01 00:00:00",
  });
  const before = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  const secondAdmin = await createUser({
    fullName: "Concurrent Settings Admin",
    email: "concurrent.settings.admin@test.local",
    role: "ADMIN",
  });
  const path = "/api/admin/settings/system_name";
  const responses = await Promise.all([
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
      .send({ setting_value: "Concurrent HCMS" }),
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokenFor(secondAdmin)}`)
      .send({ setting_value: "Concurrent HCMS" }),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);

  const stored = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.equal(stored.setting_value, "Concurrent HCMS");
  assert.ok(stored.updated_at.getTime() > before.updated_at.getTime());
  const logs = await db("activity_logs").where({
    action: "UPDATE_SYSTEM_SETTING",
    entity_id: stored.id,
  });
  assert.equal(logs.length, 1);
  assert.equal(String(stored.updated_by_admin_id), String(logs[0].user_id));
  assert.ok(
    [users.admin.id, secondAdmin.id]
      .map(String)
      .includes(String(stored.updated_by_admin_id)),
  );
  for (const response of responses) {
    assert.equal(
      new Date(response.body.data.setting.updated_at).getTime(),
      stored.updated_at.getTime(),
    );
  }
});

test("concurrent different System Setting updates serialize with consistent logs", async () => {
  await seedSystemSettings();
  const path = "/api/admin/settings/system_name";
  const authorization = `Bearer ${tokenFor(users.admin)}`;
  const submittedValues = ["First Concurrent Name", "Second Concurrent Name"];
  const responses = await Promise.all(
    submittedValues.map((settingValue) =>
      request(app)
        .patch(path)
        .set("Authorization", authorization)
        .send({ setting_value: settingValue }),
    ),
  );
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);

  const stored = await db("system_settings")
    .where({ setting_key: "system_name" })
    .first();
  assert.ok(submittedValues.includes(stored.setting_value));
  const logs = await db("activity_logs").where({
    action: "UPDATE_SYSTEM_SETTING",
    entity_id: stored.id,
  });
  assert.equal(logs.length, 2);
  assert.ok(
    responses.some(
      (response) =>
        response.body.data.setting.setting_value === stored.setting_value,
    ),
  );
});

test("System Setting seed is idempotent and preserves customized values", async () => {
  await seedSystemSettings();
  const customUpdatedAt = "2026-02-03 04:05:06";
  await db("system_settings").where({ setting_key: "system_name" }).update({
    setting_value: "Customized HCMS",
    updated_by_admin_id: users.admin.id,
    description: "Customized system display name",
    updated_at: customUpdatedAt,
  });
  await db("system_settings").where({ setting_key: "support_phone" }).del();

  await seedSystemSettings();

  const settings = await db("system_settings").orderBy("setting_key", "asc");
  assert.equal(settings.length, 3);
  assert.equal(
    settings.find((setting) => setting.setting_key === "system_name")
      .setting_value,
    "Customized HCMS",
  );
  assert.equal(
    String(
      settings.find((setting) => setting.setting_key === "system_name")
        .updated_by_admin_id,
    ),
    String(users.admin.id),
  );
  assert.equal(
    settings.find((setting) => setting.setting_key === "system_name")
      .description,
    "Customized system display name",
  );
  assert.equal(
    settings
      .find((setting) => setting.setting_key === "system_name")
      .updated_at.getTime(),
    new Date(customUpdatedAt).getTime(),
  );
  assert.equal(
    settings.find((setting) => setting.setting_key === "support_phone")
      .setting_value,
    null,
  );
});
