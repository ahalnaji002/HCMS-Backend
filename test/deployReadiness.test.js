const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  MIN_JWT_SECRET_LENGTH,
  assertValidEnvironment,
  findEnvironmentProblems,
} = require("../src/config/validateEnvironment");
const { formatUtcOffset, syncSessionTimeZone } = require("../src/config/timeZone");
const knexfile = require("../knexfile");

const validProduction = {
  NODE_ENV: "production",
  DB_HOST: "mysql.example.test",
  DB_PORT: "3306",
  DB_USER: "hcms",
  DB_PASSWORD: "secret",
  DB_NAME: "hcms",
  JWT_SECRET: "x".repeat(MIN_JWT_SECRET_LENGTH),
  JWT_EXPIRES_IN: "1h",
  CORS_ORIGIN: "https://hcms.example.test",
  TZ: "Asia/Gaza",
  DB_SSL_CA: "-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----",
};

test("environment checks are skipped outside production", () => {
  assert.deepEqual(findEnvironmentProblems({ NODE_ENV: "development" }), []);
  assert.deepEqual(findEnvironmentProblems({}), []);
});

test("a complete production environment passes", () => {
  assert.deepEqual(findEnvironmentProblems(validProduction), []);
  assert.doesNotThrow(() => assertValidEnvironment(validProduction));
});

test("production reports every missing setting", () => {
  const problems = findEnvironmentProblems({ NODE_ENV: "production" });

  for (const name of ["DB_HOST", "DB_PASSWORD", "JWT_SECRET", "CORS_ORIGIN", "TZ"]) {
    assert.ok(problems.includes(`${name} is required in production`), name);
  }
  assert.ok(problems.includes("DB_SSL_CA (or DB_SSL=true) is required in production"));
  assert.throws(() => assertValidEnvironment({ NODE_ENV: "production" }), /Invalid production configuration/);
});

test("production rejects a short JWT secret", () => {
  const problems = findEnvironmentProblems({ ...validProduction, JWT_SECRET: "short-secret" });

  assert.deepEqual(problems, [
    `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`,
  ]);
});

test("DB_SSL=true is accepted instead of a CA certificate", () => {
  const { DB_SSL_CA, ...withoutCa } = validProduction;
  assert.ok(DB_SSL_CA);
  assert.deepEqual(findEnvironmentProblems({ ...withoutCa, DB_SSL: "true" }), []);
});

test("the production knex config uses TLS, a small pool and the time zone hook", () => {
  const config = knexfile.buildProductionConfig(validProduction);

  assert.equal(config.client, "mysql2");
  assert.equal(config.connection.host, "mysql.example.test");
  assert.deepEqual(config.connection.ssl, {
    ca: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
    rejectUnauthorized: true,
  });
  assert.equal(config.pool.min, 0);
  assert.equal(config.pool.max, 5);
  assert.equal(config.pool.afterCreate, syncSessionTimeZone);
  assert.ok(knexfile.production, "knex can find the production environment");
});

test("the production knex config honours DB_POOL_MAX and DB_SSL", () => {
  const { DB_SSL_CA, ...withoutCa } = validProduction;
  assert.ok(DB_SSL_CA);
  const config = knexfile.buildProductionConfig({ ...withoutCa, DB_SSL: "true", DB_POOL_MAX: "3" });

  assert.deepEqual(config.connection.ssl, { rejectUnauthorized: true });
  assert.equal(config.pool.max, 3);
});

test("formatUtcOffset writes the offset east of UTC as ±HH:MM", () => {
  const at = (minutesWest) => ({ getTimezoneOffset: () => minutesWest });

  assert.equal(formatUtcOffset(at(-120)), "+02:00");
  assert.equal(formatUtcOffset(at(-180)), "+03:00");
  assert.equal(formatUtcOffset(at(0)), "+00:00");
  assert.equal(formatUtcOffset(at(300)), "-05:00");
  assert.equal(formatUtcOffset(at(-330)), "+05:30");
});

test("syncSessionTimeZone sets the connection to Node's offset", async () => {
  const calls = [];
  const connection = {
    query(sql, values, callback) {
      calls.push([sql, values]);
      callback(null);
    },
  };

  const result = await new Promise((resolve, reject) => {
    syncSessionTimeZone(connection, (error, conn) => (error ? reject(error) : resolve(conn)));
  });

  assert.equal(result, connection);
  assert.deepEqual(calls, [["SET time_zone = ?", [formatUtcOffset()]]]);
});
