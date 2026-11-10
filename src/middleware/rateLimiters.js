const { rateLimit } = require("express-rate-limit");

const MINUTE_MS = 60 * 1000;

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }

  return value;
}

function rateLimitExceeded(req, res) {
  return res.status(429).json({
    success: false,
    message: "Too many requests, please try again later",
  });
}

/**
 * Builds an IP-based limiter with the project's standard JSON 429 response.
 *
 * Limiters are skipped while NODE_ENV is "test" so the integration suite,
 * which issues many requests from one address, is not throttled. Pass
 * `enabledInTest: true` to exercise a limiter directly in a test.
 */
function createRateLimiter({
  windowMs,
  limit,
  skipSuccessfulRequests = false,
  enabledInTest = false,
}) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: rateLimitExceeded,
    skip: () => !enabledInTest && process.env.NODE_ENV === "test",
  });
}

// Public, unauthenticated emergency alerts: block automated flooding while
// leaving room for several genuine alerts from a shared connection.
const publicEmergencyAlertLimiter = createRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: readPositiveInteger("RATE_LIMIT_EMERGENCY_MAX", 10),
});

// Login: only failed attempts count, so legitimate users are not locked out
// by their own successful sign-ins while password guessing is slowed down.
const loginLimiter = createRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: readPositiveInteger("RATE_LIMIT_LOGIN_MAX", 10),
  skipSuccessfulRequests: true,
});

// Registration endpoints: limit mass account creation.
const registrationLimiter = createRateLimiter({
  windowMs: 60 * MINUTE_MS,
  limit: readPositiveInteger("RATE_LIMIT_REGISTER_MAX", 10),
});

module.exports = {
  createRateLimiter,
  publicEmergencyAlertLimiter,
  loginLimiter,
  registrationLimiter,
};
