const { test } = require("node:test");
const assert = require("node:assert/strict");

const express = require("express");
const cors = require("cors");
const request = require("supertest");

const app = require("../src/app");
const { createRateLimiter } = require("../src/middleware/rateLimiters");
const {
  DEFAULT_DEVELOPMENT_ORIGINS,
  buildCorsOptions,
  parseAllowedOrigins,
} = require("../src/config/cors");

function limitedApp(options) {
  const limitedTestApp = express();
  limitedTestApp.post("/limited", createRateLimiter(options), (req, res) =>
    res.status(res.locals.status || 201).json({ success: true }),
  );
  limitedTestApp.post(
    "/failing",
    createRateLimiter(options),
    (req, res) => res.status(401).json({ success: false }),
  );
  return limitedTestApp;
}

test("rate limiter returns the standard JSON 429 response after the limit", async () => {
  const limitedTestApp = limitedApp({
    windowMs: 60_000,
    limit: 2,
    enabledInTest: true,
  });

  await request(limitedTestApp).post("/limited").expect(201);
  await request(limitedTestApp).post("/limited").expect(201);
  const response = await request(limitedTestApp).post("/limited").expect(429);

  assert.deepEqual(response.body, {
    success: false,
    message: "Too many requests, please try again later",
  });
  assert.ok(response.headers["ratelimit"] || response.headers["ratelimit-policy"]);
});

test("login-style limiter counts failed requests only", async () => {
  const limitedTestApp = express();
  const limiter = createRateLimiter({
    windowMs: 60_000,
    limit: 2,
    skipSuccessfulRequests: true,
    enabledInTest: true,
  });
  limitedTestApp.post("/login", limiter, (req, res) =>
    res.status(req.query.ok === "1" ? 200 : 401).json({}),
  );

  for (let i = 0; i < 5; i += 1) {
    await request(limitedTestApp).post("/login?ok=1").expect(200);
  }
  await request(limitedTestApp).post("/login").expect(401);
  await request(limitedTestApp).post("/login").expect(401);
  await request(limitedTestApp).post("/login").expect(429);
});

test("rate limiters are skipped in the test environment unless enabled", async () => {
  const limitedTestApp = limitedApp({ windowMs: 60_000, limit: 1 });

  await request(limitedTestApp).post("/limited").expect(201);
  await request(limitedTestApp).post("/limited").expect(201);
});

test("CORS allows configured origins and rejects others", async () => {
  const corsApp = express();
  corsApp.use(
    cors(buildCorsOptions({ CORS_ORIGIN: "https://hcms.example.org/, http://localhost:5173" })),
  );
  corsApp.get("/", (req, res) => res.json({ ok: true }));

  const allowed = await request(corsApp)
    .get("/")
    .set("Origin", "https://hcms.example.org")
    .expect(200);
  assert.equal(
    allowed.headers["access-control-allow-origin"],
    "https://hcms.example.org",
  );

  const rejected = await request(corsApp)
    .get("/")
    .set("Origin", "https://attacker.example")
    .expect(200);
  assert.equal(rejected.headers["access-control-allow-origin"], undefined);
});

test("CORS falls back to the local development origins", () => {
  assert.deepEqual(parseAllowedOrigins(undefined), DEFAULT_DEVELOPMENT_ORIGINS);
  assert.deepEqual(parseAllowedOrigins("  "), DEFAULT_DEVELOPMENT_ORIGINS);
});

test("API responses include helmet security headers", async () => {
  const response = await request(app).get("/").expect(200);

  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.ok(response.headers["content-security-policy"]);
  assert.equal(response.headers["x-powered-by"], undefined);
});

test("the main app allows the default frontend origin", async () => {
  const response = await request(app)
    .get("/")
    .set("Origin", "http://localhost:5173")
    .expect(200);

  assert.equal(
    response.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
});
