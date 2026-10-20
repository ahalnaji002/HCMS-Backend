const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");

process.env.NODE_ENV = "test";
require("dotenv").config({ quiet: true });

const mysql = require("mysql2/promise");
const BASE_TEST_DATABASE = "hcms_test_db";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function runNode(args, env) {
  const result = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function main() {
  const baseDatabase = process.env.TEST_DB_NAME;
  const developmentDatabase = process.env.DB_NAME;
  const host = process.env.TEST_DB_HOST;
  const user = process.env.TEST_DB_USER;

  if (baseDatabase !== BASE_TEST_DATABASE) {
    throw new Error(`TEST_DB_NAME must be ${BASE_TEST_DATABASE}`);
  }
  if (!developmentDatabase || baseDatabase === developmentDatabase) {
    throw new Error("The test database must differ from DB_NAME");
  }
  if (!host || !LOCAL_HOSTS.has(host.toLowerCase())) {
    throw new Error("The isolated runner only permits a local TEST_DB_HOST");
  }
  if (!user) throw new Error("TEST_DB_USER is required");

  const temporaryDatabase = `hcms_test_run_${process.pid}_${randomBytes(6).toString("hex")}`;
  if (temporaryDatabase === developmentDatabase || temporaryDatabase === baseDatabase) {
    throw new Error("Refusing to use a non-temporary database name");
  }

  let adminConnection;
  let temporaryDatabaseCreated = false;
  let resultCode = 1;

  try {
    adminConnection = await mysql.createConnection({
      host,
      port: Number(process.env.TEST_DB_PORT || 3306),
      user,
      password: process.env.TEST_DB_PASSWORD,
    });

    const [existing] = await adminConnection.execute(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [temporaryDatabase],
    );
    if (existing.length > 0) {
      throw new Error("Temporary database name already exists; refusing to reuse it");
    }

    await adminConnection.query(
      `CREATE DATABASE \`${temporaryDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    temporaryDatabaseCreated = true;
    console.log(`Created disposable test database: ${temporaryDatabase}`);

    const testEnvironment = {
      ...process.env,
      NODE_ENV: "test",
      TEST_DB_NAME: temporaryDatabase,
      HCMS_ISOLATED_TEST_DB: "1",
    };
    const knexCli = require.resolve("knex/bin/cli.js");

    resultCode = runNode([knexCli, "migrate:latest", "--env", "test"], testEnvironment);
    if (resultCode === 0) {
      resultCode = runNode(["--test", ...process.argv.slice(2)], testEnvironment);
    }
  } catch (error) {
    const detail = [error.code, error.message].filter(Boolean).join(": ") || String(error);
    console.error(`Isolated test run failed: ${detail}`);
    resultCode = 1;
  } finally {
    if (adminConnection && temporaryDatabaseCreated) {
      try {
        await adminConnection.query(`DROP DATABASE \`${temporaryDatabase}\``);
        console.log(`Dropped disposable test database: ${temporaryDatabase}`);
      } catch (error) {
        console.error(
          `Failed to drop only the disposable database ${temporaryDatabase}: ${error.message}`,
        );
        resultCode = 1;
      }
    }
    if (adminConnection) await adminConnection.end();
  }

  process.exitCode = resultCode;
}

main();
