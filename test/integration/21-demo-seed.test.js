const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { db, registerIntegrationHooks } = require("../helpers/integrationHarness");

// Demo seed script (scripts/seedDemoData.js)
registerIntegrationHooks();

const SCRIPT = path.resolve(__dirname, "../../scripts/seedDemoData.js");

function runSeed(extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
  });
}

async function countBy(table, column) {
  const rows = await db(table).select(column).count("* as n").groupBy(column);
  return Object.fromEntries(rows.map((row) => [row[column], Number(row.n)]));
}

test("demo seed creates every workflow state through the API and refuses a second run", async () => {
  const first = runSeed();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /Demo data created through \d+ API requests/);

  const demoUsers = await db("users").where("email", "like", "%@demo.hcms.test");
  assert.equal(demoUsers.length, 18);

  assert.deepEqual(await countBy("join_requests", "status"), { APPROVED: 7, PENDING: 2, REJECTED: 1 });
  assert.deepEqual(await countBy("emergency_alerts", "status"), {
    PENDING_ASSIGNMENT: 2, ASSIGNED: 1, IN_PROGRESS: 1, RESOLVED: 1, CANCELLED: 1,
  });
  assert.deepEqual(await countBy("assistance_requests", "status"), {
    PENDING: 1, UNDER_REVIEW: 1, APPROVED: 1, REJECTED: 1, COMPLETED: 1,
  });

  const intakes = await countBy("patient_intakes", "status");
  assert.equal(intakes.SUBMITTED, 1);
  assert.equal(intakes.DOCTOR_ASSIGNED, 5);

  const [{ n: plans }] = await db("treatment_plans").count("* as n");
  assert.equal(Number(plans), 6);
  const [{ n: notifications }] = await db("notifications").count("* as n");
  assert.ok(Number(notifications) > 0, "services should have produced notifications");

  const second = runSeed();
  assert.equal(second.status, 1);
  assert.match(second.stderr, /Demo data already exists/);
});

test("demo seed refuses to run in production without explicit permission", () => {
  const result = runSeed({ NODE_ENV: "production", HCMS_ALLOW_DEMO_SEED: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to seed demo data with NODE_ENV=production/);
});
