const UNSIGNED_BIGINT_MAX = 18446744073709551615n;
const TEXT_MAX_BYTES = 65535;

const EDITABLE_FIELDS = new Set([
  "medication_name",
  "dosage",
  "frequency",
  "duration",
  "instructions",
]);

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function isValidPositiveId(value) {
  const stringValue = String(value);

  if (!/^[1-9]\d*$/.test(stringValue)) {
    return false;
  }

  try {
    return BigInt(stringValue) <= UNSIGNED_BIGINT_MAX;
  } catch {
    return false;
  }
}

function validatePlanId(req, res, next) {
  if (!isValidPositiveId(req.params.planId)) {
    return validationFailure(res, {
      planId: "planId must be a positive integer",
    });
  }

  return next();
}

function validateMedicationId(req, res, next) {
  if (!isValidPositiveId(req.params.medicationId)) {
    return validationFailure(res, {
      medicationId: "medicationId must be a positive integer",
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
    if (!EDITABLE_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }
}

function validateRequiredString(input, field, maxLength, errors, required) {
  const value = input[field];

  if (value === undefined) {
    if (required) {
      errors[field] = `${field} is required`;
    }
    return;
  }

  if (typeof value !== "string") {
    errors[field] = `${field} must be a string`;
  } else if (value.trim().length === 0) {
    errors[field] = `${field} must not be empty`;
  } else if (value.length > maxLength) {
    errors[field] = `${field} must not exceed ${maxLength} characters`;
  }
}

function validateOptionalString(input, field, maxLength, errors) {
  const value = input[field];

  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors[field] = `${field} must be a string or null`;
  } else if (value.length > maxLength) {
    errors[field] = `${field} must not exceed ${maxLength} characters`;
  }
}

function validateInstructions(input, errors) {
  const value = input.instructions;

  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors.instructions = "instructions must be a string or null";
  } else if (Buffer.byteLength(value, "utf8") > TEXT_MAX_BYTES) {
    errors.instructions = "instructions must not exceed 65535 bytes";
  }
}

function validateFields(input, errors, required) {
  validateAllowedFields(input, errors);
  validateRequiredString(input, "medication_name", 150, errors, required);
  validateRequiredString(input, "dosage", 100, errors, required);
  validateRequiredString(input, "frequency", 100, errors, required);
  validateOptionalString(input, "duration", 100, errors);
  validateInstructions(input, errors);
}

function buildValidatedMedication(input) {
  const validated = {};

  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      continue;
    }

    if (["medication_name", "dosage", "frequency"].includes(field)) {
      validated[field] = input[field].trim();
    } else {
      validated[field] = input[field];
    }
  }

  return validated;
}

function validateCreateTreatmentMedication(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  validateFields(input, errors, true);

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedTreatmentMedication = buildValidatedMedication(input);
  return next();
}

function validateUpdateTreatmentMedication(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  validateFields(input, errors, false);

  if (Object.keys(input).length === 0) {
    errors.body = "at least one editable field is required";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedTreatmentMedication = buildValidatedMedication(input);
  return next();
}

module.exports = {
  validateCreateTreatmentMedication,
  validateMedicationId,
  validatePlanId,
  validateUpdateTreatmentMedication,
};
