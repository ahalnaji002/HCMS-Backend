const MAX_TEXT_BYTES = 65535;
const MAX_ID = 18446744073709551615n;

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function isPositiveId(value) {
  return (
    typeof value === "string" &&
    /^[1-9][0-9]*$/.test(value) &&
    BigInt(value) <= MAX_ID
  );
}

function validateCorrectionRequestId(req, res, next) {
  if (!isPositiveId(req.params.requestId)) {
    return validationFailure(res, { requestId: "requestId must be a positive integer" });
  }
  req.validatedCorrectionRequestId = req.params.requestId;
  return next();
}

function validateCreateCorrectionRequest(req, res, next) {
  const input = req.body;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const errors = {};
  for (const field of Object.keys(input)) {
    if (field !== "message") errors[field] = `${field} is not allowed`;
  }
  if (typeof input.message !== "string") {
    errors.message = "message is required and must be a string";
  } else if (input.message.trim().length === 0) {
    errors.message = "message must not be empty";
  } else if (Buffer.byteLength(input.message, "utf8") > MAX_TEXT_BYTES) {
    errors.message = `message must not exceed ${MAX_TEXT_BYTES} UTF-8 bytes`;
  }
  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedCorrectionMessage = input.message.trim();
  return next();
}

function validateResolveCorrectionRequest(req, res, next) {
  const input = req.body;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const errors = {};
  for (const field of Object.keys(input)) {
    if (field !== "admin_response") errors[field] = `${field} is not allowed`;
  }
  if (typeof input.admin_response !== "string") {
    errors.admin_response = "admin_response is required and must be a string";
  } else if (input.admin_response.trim().length === 0) {
    errors.admin_response = "admin_response must not be empty";
  } else if (Buffer.byteLength(input.admin_response, "utf8") > MAX_TEXT_BYTES) {
    errors.admin_response = `admin_response must not exceed ${MAX_TEXT_BYTES} UTF-8 bytes`;
  }
  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedAdminResponse = input.admin_response.trim();
  return next();
}

module.exports = {
  validateCorrectionRequestId,
  validateCreateCorrectionRequest,
  validateResolveCorrectionRequest,
};
