function apiNotFound(req, res) {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
}

function apiErrorHandler(error, req, res, next) {
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }

  console.error("Unhandled API error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

module.exports = {
  apiNotFound,
  apiErrorHandler,
};
