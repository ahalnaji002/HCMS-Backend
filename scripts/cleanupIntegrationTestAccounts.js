const path = require("node:path");
const net = require("node:net");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const knexFactory = require("knex");
const knexConfig = require("../knexfile");
// Set this exact, explicit confirmation only when running local test-account cleanup.
const SAFE_CLEANUP_AUTHORIZATION = "I_CONFIRM_LOCAL_HCMS_TEST_DB_CLEANUP";
const TEST_DATABASE_NAME = "hcms_test_db";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SAFE_CONNECTION_OPTIONS = new Set(["host", "port", "user", "password", "database"]);
const expectedRoles = {
  patient: "PATIENT",
  doctor: "DOCTOR",
  ngo: "NGO",
};

function validateAccounts(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error("Provide exactly one Patient, Doctor, and NGO test email");
  }

  const roles = new Set();
  const stamps = new Set();
  for (const email of value) {
    const match = /^integration\.(patient|doctor|ngo)\.\d+@hcms\.test$/.exec(email);
    if (!match || roles.has(match[1])) {
      throw new Error("Only one email for each reserved integration test role is allowed");
    }
    roles.add(match[1]);
    stamps.add(match[0].match(/\.(\d+)@/)[1]);
  }

  if (roles.size !== 3 || stamps.size !== 1) {
    throw new Error("Provide exactly one Patient, Doctor, and NGO test email");
  }
  return value;
}

function validateIntegrationUsers(users) {
  for (const user of users) {
    const match = /^integration\.(patient|doctor|ngo)\.\d+@hcms\.test$/.exec(
      user.email
    );
    const roleKey = match?.[1];
    if (
      !roleKey ||
      user.role !== expectedRoles[roleKey]
    ) {
      throw new Error(`Refusing to delete non-test account ${user.email}`);
    }
  }
}

function validateSafeCleanupConfiguration(environment, config) {
  if (environment.NODE_ENV !== "test") {
    throw new Error("Integration account cleanup requires NODE_ENV=test");
  }

  if (environment.HCMS_ALLOW_INTEGRATION_ACCOUNT_CLEANUP !== SAFE_CLEANUP_AUTHORIZATION) {
    throw new Error(
      "Explicit HCMS_ALLOW_INTEGRATION_ACCOUNT_CLEANUP authorization is required",
    );
  }

  const connection = config?.connection;
  const configuredHost = typeof connection?.host === "string"
    ? connection.host.toLowerCase().replace(/^\[|\]$/g, "")
    : "";
  const port = Number(connection?.port || 3306);
  if (
    config?.client !== "mysql2" ||
    !connection ||
    !LOCAL_HOSTS.has(configuredHost) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    typeof connection.user !== "string" ||
    connection.user.trim().length === 0 ||
    connection.database !== TEST_DATABASE_NAME ||
    Object.keys(connection).some((key) => !SAFE_CONNECTION_OPTIONS.has(key))
  ) {
    throw new Error(
      "Unsafe test database connection configuration; use a local MySQL TCP connection to hcms_test_db",
    );
  }

  if (
    environment.TEST_DB_NAME !== TEST_DATABASE_NAME ||
    typeof environment.DB_NAME !== "string" ||
    environment.DB_NAME.trim().length === 0 ||
    environment.TEST_DB_NAME === environment.DB_NAME
  ) {
    throw new Error(
      "Integration account cleanup is restricted to a distinct TEST_DB_NAME=hcms_test_db",
    );
  }

  return { port };
}

function isLoopbackAddress(address) {
  if (typeof address !== "string") return false;
  let normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) normalized = normalized.slice(7);
  if (net.isIPv4(normalized)) return Number(normalized.split(".")[0]) === 127;
  return false;
}

async function verifyConnectedTestDatabase(database, expectedPort) {
  const connection = await database.client.acquireConnection();
  try {
    // This validates the TCP peer only; a local tunnel may still relay to a remote server.
    if (!isLoopbackAddress(connection?.stream?.remoteAddress)) {
      throw new Error("Connected MySQL TCP peer is not a local loopback address");
    }

    const rows = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT DATABASE() AS database_name, @@hostname AS server_hostname, @@port AS server_port",
        (error, result) => error ? reject(error) : resolve(result),
      );
    });
    const identity = Array.isArray(rows) ? rows[0] : undefined;
    if (
      identity?.database_name !== TEST_DATABASE_NAME ||
      typeof identity.server_hostname !== "string" ||
      identity.server_hostname.trim().length === 0 ||
      Number(identity.server_port) !== expectedPort
    ) {
      throw new Error(
        "Connected MySQL schema or server settings do not match the expected test database",
      );
    }
  } finally {
    await database.client.releaseConnection(connection);
  }
}

async function cleanupIntegrationTestAccounts(
  { emails, stale = false } = {},
  dependencies = {},
) {
  const environment = dependencies.environment || process.env;
  const config = dependencies.config || knexConfig.test;
  const createDatabase = dependencies.createDatabase || knexFactory;
  const { port } = validateSafeCleanupConfiguration(environment, config);
  const database = createDatabase(config);
  try {
    await verifyConnectedTestDatabase(database, port);

    let usersQuery = database("users").select("id", "email", "role", "full_name");
    if (stale) {
      usersQuery = usersQuery.where((query) => {
        query
          .where("email", "like", "integration.patient.%@hcms.test")
          .orWhere("email", "like", "integration.doctor.%@hcms.test")
          .orWhere("email", "like", "integration.ngo.%@hcms.test");
      });
    } else {
      usersQuery = usersQuery.whereIn("email", validateAccounts(emails));
    }

    const users = await usersQuery;
    validateIntegrationUsers(users);

    await database.transaction(async (trx) => {
      const userIds = users.map(({ id }) => id);
      if (userIds.length === 0) return;

      await trx("join_requests").whereIn("user_id", userIds).del();
      await trx("patients").whereIn("user_id", userIds).del();
      await trx("doctors").whereIn("user_id", userIds).del();
      await trx("ngos").whereIn("user_id", userIds).del();
      await trx("users").whereIn("id", userIds).del();
    });

    return users.length;
  } finally {
    await database.destroy();
  }
}

if (require.main === module) {
  const stale = process.argv[2] === "--stale";
  const emails = stale ? undefined : JSON.parse(process.argv[2] || "null");
  cleanupIntegrationTestAccounts({ emails, stale })
    .then((count) => {
      console.log(`Removed ${count} integration test account(s) from hcms_test_db`);
    })
    .catch((error) => {
      console.error("Integration account cleanup failed:", error.message);
      process.exitCode = 1;
    });
}

module.exports = cleanupIntegrationTestAccounts;
