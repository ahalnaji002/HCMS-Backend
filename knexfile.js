require("dotenv").config({ quiet: true });

const { syncSessionTimeZone } = require("./src/config/timeZone");

const sharedConfig = {
  client: "mysql2",

  migrations: {
    directory: "./database/migrations",
  },

  pool: {
    afterCreate: syncSessionTimeZone,
  },
};

// Managed MySQL (e.g. Aiven) requires TLS. DB_SSL_CA holds the provider's CA
// certificate as PEM text; "\n" escapes are accepted for one-line env values.
function buildSslOptions(env) {
  if (env.DB_SSL_CA && env.DB_SSL_CA.trim() !== "") {
    return { ca: env.DB_SSL_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  }

  if (env.DB_SSL === "true") {
    return { rejectUnauthorized: true };
  }

  return undefined;
}

function buildProductionConfig(env = process.env) {
  const ssl = buildSslOptions(env);
  const poolMax = Number(env.DB_POOL_MAX || 5);

  return {
    ...sharedConfig,

    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ...(ssl ? { ssl } : {}),
    },

    pool: {
      ...sharedConfig.pool,
      min: 0,
      max: Number.isSafeInteger(poolMax) && poolMax > 0 ? poolMax : 5,
    },

    seeds: {
      directory: "./database/seeds",
    },
  };
}

module.exports = {
  development: {
    ...sharedConfig,

    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },

    seeds: {
      directory: "./database/seeds",
    },
  },

  test: {
    ...sharedConfig,

    connection: {
      host: process.env.TEST_DB_HOST,
      port: process.env.TEST_DB_PORT,
      user: process.env.TEST_DB_USER,
      password: process.env.TEST_DB_PASSWORD,
      database: process.env.TEST_DB_NAME,
    },
  },

  production: buildProductionConfig(),
};

// Exposed for tests; knex only reads the environment keys above.
Object.defineProperty(module.exports, "buildProductionConfig", {
  value: buildProductionConfig,
  enumerable: false,
});
