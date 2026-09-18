require("dotenv").config();

const sharedConfig = {
  client: "mysql2",

  migrations: {
    directory: "./database/migrations",
  },
};

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
};
