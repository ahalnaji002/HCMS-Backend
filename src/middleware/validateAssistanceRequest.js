const REQUEST_TYPE_MAX_LENGTH = 100;
const TEXT_MAX_BYTES = 65535;
const UNSIGNED_BIGINT_MAX = 18446744073709551615n;

const CREATE_FIELDS = new Set(["request_type", "description"]);

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

function validatePatientId(req, res, next) {
  if (!isValidPositiveId(req.params.patientId)) {
    return validationFailure(res, {
      patientId: "patientId must be a positive integer",
    });
  }

  req.validatedAssistanceRequestPatientId = String(req.params.patientId);

  return next();
}

function validateRequestId(req, res, next) {
  if (!isValidPositiveId(req.params.requestId)) {
    return validationFailure(res, {
      requestId: "requestId must be a positive integer",
    });
  }

  req.validatedAssistanceRequestId = String(req.params.requestId);

  return next();
}

function validateCreateAssistanceRequest(req, res, next) {
  const input = req.body;

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, {
      body: "request body must be a JSON object",
    });
  }

  const errors = {};

  for (const field of Object.keys(input)) {
    if (!CREATE_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (input.request_type === undefined) {
    errors.request_type = "request_type is required";
  } else if (typeof input.request_type !== "string") {
    errors.request_type = "request_type must be a string";
  } else if (input.request_type.trim().length === 0) {
    errors.request_type = "request_type must not be empty";
  } else if (input.request_type.length > REQUEST_TYPE_MAX_LENGTH) {
    errors.request_type = "request_type must not exceed 100 characters";
  }

  if (input.description === undefined) {
    errors.description = "description is required";
  } else if (typeof input.description !== "string") {
    errors.description = "description must be a string";
  } else if (input.description.trim().length === 0) {
    errors.description = "description must not be empty";
  } else if (Buffer.byteLength(input.description, "utf8") > TEXT_MAX_BYTES) {
    errors.description = "description must not exceed 65535 bytes";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedAssistanceRequest = {
    request_type: input.request_type.trim(),
    description: input.description.trim(),
  };

  return next();
}

module.exports = {
  validateCreateAssistanceRequest,
  validatePatientId,
  validateRequestId,
};
