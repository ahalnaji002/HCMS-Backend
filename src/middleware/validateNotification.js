const UNSIGNED_BIGINT_MAX = 18446744073709551615n;

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function isValidPositiveId(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return false;
  }

  try {
    return BigInt(value) <= UNSIGNED_BIGINT_MAX;
  } catch {
    return false;
  }
}

function validateNotificationId(req, res, next) {
  if (!isValidPositiveId(req.params.notificationId)) {
    return validationFailure(res, {
      notificationId: "notificationId must be a positive integer",
    });
  }

  req.validatedNotificationId = String(req.params.notificationId);
  return next();
}

function validateEmptyBody(req, res, next) {
  const input = req.body;

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, {
      body: "request body must be a JSON object",
    });
  }

  const fields = Object.keys(input);

  if (fields.length > 0) {
    const errors = {};

    for (const field of fields) {
      errors[field] = `${field} is not allowed`;
    }

    return validationFailure(res, errors);
  }

  return next();
}

module.exports = {
  validateEmptyBody,
  validateNotificationId,
};
