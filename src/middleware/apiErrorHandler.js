const { ApiError } = require("../utils/apiErrors");

function apiNotFound(req, res) {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
}

function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }

  // Expected errors thrown by services carry their own HTTP status.
  if (error instanceof ApiError) {
    const body = { success: false, message: error.message };

    // Field-level validation details, matching the validator middleware shape.
    if (error.errors !== undefined) {
      body.errors = error.errors;
    }

    if (error.data !== undefined) {
      body.data = error.data;
    }

    return res.status(error.statusCode).json(body);
  }

  // Unexpected errors: log enough to debug without leaking request data,
  // and return a generic message to the client.
  console.error("Unhandled API error", {
    method: req.method,
    path: req.originalUrl,
    name: error?.name,
    code: error?.code,
    stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
  });

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

module.exports = {
  apiNotFound,
  apiErrorHandler,
};
