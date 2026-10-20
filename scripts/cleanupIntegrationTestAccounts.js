const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const knexFactory = require("knex");
const knexConfig = require("../knexfile");
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

async function cleanupIntegrationTestAccounts({ emails, stale = false } = {}) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Integration account cleanup requires NODE_ENV=test");
  }

  if (process.env.TEST_DB_NAME !== "hcms_test_db") {
    throw new Error(
      "Integration account cleanup is restricted to TEST_DB_NAME=hcms_test_db"
    );
  }

  const database = knexFactory(knexConfig.test);
  try {
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
