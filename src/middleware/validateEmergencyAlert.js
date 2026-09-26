const PHONE_MAX_LENGTH = 30;
const LOCATION_MAX_LENGTH = 255;
const TEXT_MAX_BYTES = 65535;

const CREATE_FIELDS = new Set(["phone", "location", "description"]);

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

function validateAlertId(req, res, next) {
  if (!isValidPositiveId(req.params.alertId)) {
    return validationFailure(res, {
      alertId: "alertId must be a positive integer",
    });
  }

  return next();
}

function validateBodyObject(input, res) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    validationFailure(res, {
      body: "request body must be a JSON object",
    });

    return false;
  }

  return true;
}

function validateAllowedFields(input, errors) {
  for (const field of Object.keys(input)) {
    if (!CREATE_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }
}

function validatePhone(value, errors) {
  if (value === undefined) {
    errors.phone = "phone is required";
    return;
  }

  if (typeof value !== "string") {
    errors.phone = "phone must be a string";
    return;
  }

  const phone = value.trim();

  if (phone.length === 0) {
    errors.phone = "phone must not be empty";
    return;
  }

  if (phone.length > PHONE_MAX_LENGTH) {
    errors.phone = "phone must not exceed 30 characters";
  }
}

function validateLocation(value, errors) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors.location = "location must be a string or null";
    return;
  }

  if (value.length > LOCATION_MAX_LENGTH) {
    errors.location = "location must not exceed 255 characters";
  }
}

function validateDescription(value, errors) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors.description = "description must be a string or null";
    return;
  }

  if (Buffer.byteLength(value, "utf8") > TEXT_MAX_BYTES) {
    errors.description = "description must not exceed 65535 bytes";
  }
}

function validateCreateEmergencyAlert(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};

  validateAllowedFields(input, errors);
  validatePhone(input.phone, errors);
  validateLocation(input.location, errors);
  validateDescription(input.description, errors);

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedEmergencyAlert = {
    phone: input.phone.trim(),
  };

  if (Object.prototype.hasOwnProperty.call(input, "location")) {
    req.validatedEmergencyAlert.location = input.location;
  }

  if (Object.prototype.hasOwnProperty.call(input, "description")) {
    req.validatedEmergencyAlert.description = input.description;
  }

  return next();
}

function validateCancelEmergencyAlert(req, res, next) {
  if (req.body === undefined) {
    return next();
  }

  if (!validateBodyObject(req.body, res)) {
    return;
  }

  const fields = Object.keys(req.body);

  if (fields.length > 0) {
    const errors = {};

    for (const field of fields) {
      errors[field] = `${field} is not allowed`;
    }

    return validationFailure(res, errors);
  }

  return next();
}

function validateAssignEmergencyAlert(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  const allowedFields = new Set(["doctor_id"]);

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (input.doctor_id === undefined) {
    errors.doctor_id = "doctor_id is required";
  } else if (!isValidPositiveId(input.doctor_id)) {
    errors.doctor_id = "doctor_id must be a positive integer";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedEmergencyAlertAssignment = {
    doctor_id: String(input.doctor_id),
  };

  return next();
}

module.exports = {
  validateAlertId,
  validateCreateEmergencyAlert,
  validateCancelEmergencyAlert,
  validateAssignEmergencyAlert,
};
