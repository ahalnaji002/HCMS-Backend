const { test } = require("node:test");
const assert = require("node:assert/strict");

const cleanupIntegrationTestAccounts = require("../scripts/cleanupIntegrationTestAccounts");

const authorization = "I_CONFIRM_LOCAL_HCMS_TEST_DB_CLEANUP";

function safeEnvironment(overrides = {}) {
  return {
    NODE_ENV: "test",
    DB_NAME: "hcms_development_db",
    TEST_DB_NAME: "hcms_test_db",
    HCMS_ALLOW_INTEGRATION_ACCOUNT_CLEANUP: authorization,
    ...overrides,
  };
}

function safeConfig(overrides = {}) {
  return {
    client: "mysql2",
    connection: {
      host: "127.0.0.1",
      port: 3306,
      user: "hcms_test_user",
      password: "test-only-password",
      database: "hcms_test_db",
      ...overrides,
    },
  };
}

function trackingDatabase({
  actualDatabase = "hcms_test_db",
  remoteAddress = "127.0.0.1",
} = {}) {
  const deletes = [];
  const integrationUsers = [
    { id: 11, email: "integration.patient.123@hcms.test", role: "PATIENT" },
    { id: 12, email: "integration.doctor.123@hcms.test", role: "DOCTOR" },
    { id: 13, email: "integration.ngo.123@hcms.test", role: "NGO" },
  ];

  function table(name) {
    const query = {
      select() { return query; },
      where() { return query; },
      whereIn() { return query; },
      del: async () => {
        deletes.push(name);
        return 1;
      },
      then(resolve, reject) {
        return Promise.resolve(name === "users" ? integrationUsers : []).then(resolve, reject);
      },
    };
    return query;
  }

  table.transaction = async (callback) => callback(table);
  table.destroy = async () => {};
  table.client = {
    acquireConnection: async () => ({
      stream: { remoteAddress },
      query(sql, callback) {
        callback(null, [{
          database_name: actualDatabase,
          server_hostname: "hcms-test-mysql",
          server_port: "3306",
        }]);
      },
    }),
    releaseConnection: async () => {},
  };
  return { database: table, deletes };
}

async function assertRejectedWithoutDeletes({ environment, config, actualDatabase, remoteAddress }) {
  const tracker = trackingDatabase({ actualDatabase, remoteAddress });
  let connectionsCreated = 0;
  await assert.rejects(
    cleanupIntegrationTestAccounts(
      { stale: true },
      {
        environment,
        config,
        createDatabase: () => {
          connectionsCreated += 1;
          return tracker.database;
        },
      },
    ),
  );
  assert.deepEqual(tracker.deletes, [], "invalid cleanup configuration must issue no DELETEs");
  return connectionsCreated;
}

test("cleanup refuses a non-local host before opening a database connection", async () => {
  const connectionsCreated = await assertRejectedWithoutDeletes({
    environment: safeEnvironment(),
    config: safeConfig({ host: "db.example.com" }),
  });
  assert.equal(connectionsCreated, 0);
});

test("cleanup refuses an incorrect configured database name before connecting", async () => {
  const connectionsCreated = await assertRejectedWithoutDeletes({
    environment: safeEnvironment(),
    config: safeConfig({ database: "hcms_db" }),
  });
  assert.equal(connectionsCreated, 0);
});

test("cleanup refuses to run without the explicit safe-cleanup authorization", async () => {
  const connectionsCreated = await assertRejectedWithoutDeletes({
    environment: safeEnvironment({ HCMS_ALLOW_INTEGRATION_ACCOUNT_CLEANUP: undefined }),
    config: safeConfig(),
  });
  assert.equal(connectionsCreated, 0);
});

test("cleanup refuses unsafe connection options before opening a database connection", async () => {
  const connectionsCreated = await assertRejectedWithoutDeletes({
    environment: safeEnvironment(),
    config: safeConfig({ socketPath: "\\\\remote-host\\mysql.sock" }),
  });
  assert.equal(connectionsCreated, 0);
});

test("cleanup refuses a connection whose actual schema is not hcms_test_db", async () => {
  const connectionsCreated = await assertRejectedWithoutDeletes({
    environment: safeEnvironment(),
    config: safeConfig(),
    actualDatabase: "hcms_db",
  });
  assert.equal(connectionsCreated, 1);
});

test("cleanup refuses a MySQL TCP connection with a non-loopback peer address", async () => {
  const connectionsCreated = await assertRejectedWithoutDeletes({
    environment: safeEnvironment(),
    config: safeConfig(),
    remoteAddress: "10.20.30.40",
  });
  assert.equal(connectionsCreated, 1);
});

test("authorized local cleanup preserves the reserved integration-account workflow", async () => {
  const tracker = trackingDatabase();
  const deletedCount = await cleanupIntegrationTestAccounts(
    { stale: true },
    {
      environment: safeEnvironment(),
      config: safeConfig(),
      createDatabase: () => tracker.database,
    },
  );

  assert.equal(deletedCount, 3);
  assert.deepEqual(tracker.deletes, ["join_requests", "patients", "doctors", "ngos", "users"]);
});
