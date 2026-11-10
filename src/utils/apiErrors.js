/**
 * Base classes for expected API errors.
 *
 * Service-layer errors extend one of these classes so the central
 * `apiErrorHandler` can translate them into the standard response shape:
 * `{ success: false, message, data? }` with the class's HTTP status.
 * Any other error is treated as unexpected and returned as a generic 500.
 */
class ApiError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;

    if (data !== undefined) {
      this.data = data;
    }
  }
}

class BadRequestError extends ApiError {
  constructor(message, data) {
    super(message, 400, data);
  }
}

class UnauthorizedError extends ApiError {
  constructor(message, data) {
    super(message, 401, data);
  }
}

class ForbiddenError extends ApiError {
  constructor(message, data) {
    super(message, 403, data);
  }
}

class NotFoundError extends ApiError {
  constructor(message, data) {
    super(message, 404, data);
  }
}

class ConflictError extends ApiError {
  constructor(message, data) {
    super(message, 409, data);
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
