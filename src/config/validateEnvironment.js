// Checks the settings a production server cannot run safely without, so a
// missing or weak value stops the start with a clear message instead of
// failing later on the first request.

const MIN_JWT_SECRET_LENGTH = 32;

const REQUIRED_IN_PRODUCTION = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "CORS_ORIGIN",
  "TZ",
];

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function findEnvironmentProblems(env = process.env) {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const problems = REQUIRED_IN_PRODUCTION.filter((name) => isBlank(env[name])).map(
    (name) => `${name} is required in production`,
  );

  if (!isBlank(env.JWT_SECRET) && env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`,
    );
  }

  if (isBlank(env.DB_SSL_CA) && env.DB_SSL !== "true") {
    problems.push("DB_SSL_CA (or DB_SSL=true) is required in production");
  }

  return problems;
}

function assertValidEnvironment(env = process.env) {
  const problems = findEnvironmentProblems(env);

  if (problems.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${problems.join("\n- ")}`);
  }
}

module.exports = {
  MIN_JWT_SECRET_LENGTH,
  assertValidEnvironment,
  findEnvironmentProblems,
};
