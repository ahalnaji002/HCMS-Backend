const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");
const { formatUtcOffset } = require("../../src/config/timeZone");
const healthService = require("../../src/services/healthService");
const { formatLocalDateTime } = require("../../src/services/reminderService");

// Health check and one time zone across Node and MySQL
registerIntegrationHooks();

test("health check is public and reports a reachable database", async () => {
  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: { status: "ok", database: "up" },
  });
});

test("health check returns 503 without details when the database fails", async (t) => {
  t.mock.method(healthService, "checkDatabase", async () => {
    const error = new Error("connect ECONNREFUSED 10.0.0.1:3306");
    error.code = "ECONNREFUSED";
    throw error;
  });
  t.mock.method(console, "error", () => {});

  const response = await request(app).get("/api/health");

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { success: false, message: "Database unavailable" });
});

test("database sessions use the same UTC offset as Node", async () => {
  const [rows] = await db.raw("SELECT @@session.time_zone AS zone");

  assert.equal(rows[0].zone, formatUtcOffset());
});

test("CURRENT_TIMESTAMP matches the wall-clock time Node writes", async () => {
  const before = formatLocalDateTime(new Date()).slice(0, 16);
  const [rows] = await db.raw("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i') AS now_text");
  const after = formatLocalDateTime(new Date()).slice(0, 16);

  // The minute may roll over between the reads.
  assert.ok([before, after].includes(rows[0].now_text), `${rows[0].now_text} vs ${before}`);
});
