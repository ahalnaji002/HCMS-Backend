const { test } = require("node:test");
const assert = require("node:assert/strict");

const express = require("express");
const request = require("supertest");

const { apiErrorHandler } = require("../src/middleware/apiErrorHandler");
const {
  ApiError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} = require("../src/utils/apiErrors");

function appThrowing(error) {
  const app = express();
  app.get("/boom", async () => {
    throw error;
  });
  app.use(apiErrorHandler);
  return app;
}

test("ApiError subclasses carry their HTTP status and class name", () => {
  const cases = [
    [BadRequestError, 400],
    [UnauthorizedError, 401],
    [ForbiddenError, 403],
    [NotFoundError, 404],
    [ConflictError, 409],
  ];

  for (const [ErrorClass, status] of cases) {
    class ExampleError extends ErrorClass {}
    const error = new ExampleError("Example");

    assert.ok(error instanceof ApiError);
    assert.ok(error instanceof Error);
    assert.equal(error.statusCode, status);
    assert.equal(error.name, "ExampleError");
  }
});

test("async errors thrown by handlers reach the central handler", async () => {
  class ThingNotFoundError extends NotFoundError {}
  const response = await request(appThrowing(new ThingNotFoundError("Thing not found")))
    .get("/boom")
    .expect(404);

  assert.deepEqual(response.body, { success: false, message: "Thing not found" });
});

test("ApiError data and validation errors are included in the response", async () => {
  const withData = new ForbiddenError("Account is not active", {
    application: { status: "PENDING" },
  });
  const dataResponse = await request(appThrowing(withData)).get("/boom").expect(403);
  assert.deepEqual(dataResponse.body, {
    success: false,
    message: "Account is not active",
    data: { application: { status: "PENDING" } },
  });

  const withErrors = new BadRequestError("Validation failed");
  withErrors.errors = { field: "Field is required" };
  const errorsResponse = await request(appThrowing(withErrors)).get("/boom").expect(400);
  assert.deepEqual(errorsResponse.body, {
    success: false,
    message: "Validation failed",
    errors: { field: "Field is required" },
  });
});

test("unexpected errors return a generic 500 without internal details", async (t) => {
  t.mock.method(console, "error", () => {});
  const response = await request(appThrowing(new Error("SQL: secret table detail")))
    .get("/boom")
    .expect(500);

  assert.deepEqual(response.body, {
    success: false,
    message: "Internal server error",
  });
});
