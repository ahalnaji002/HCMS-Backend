// Local frontend origins used when CORS_ORIGIN is not set:
// Vite dev server (5173) and the Playwright suites (4178, 4179).
const DEFAULT_DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4178",
  "http://127.0.0.1:4179",
];

function parseAllowedOrigins(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_DEVELOPMENT_ORIGINS;
  }

  return value
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin !== "");
}

/**
 * CORS options restricted to the configured frontend origins.
 * CORS_ORIGIN accepts a comma-separated list, e.g.
 * "https://hcms.example.org,http://localhost:5173".
 * Requests without an Origin header (curl, server-to-server, Swagger UI on the
 * same origin) are unaffected because browsers alone enforce CORS.
 */
function buildCorsOptions(env = process.env) {
  const allowedOrigins = new Set(parseAllowedOrigins(env.CORS_ORIGIN));

  return {
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin));
    },
  };
}

module.exports = {
  DEFAULT_DEVELOPMENT_ORIGINS,
  buildCorsOptions,
  parseAllowedOrigins,
};
