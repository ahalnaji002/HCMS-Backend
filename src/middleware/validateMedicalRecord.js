const MAX_UNSIGNED_BIGINT = 18446744073709551615n;
const BLOOD_TYPE_MAX_LENGTH = 5;
const TEXT_MAX_BYTES = 65535;

const ALLOWED_FIELDS = new Set([
  "blood_type",
  "allergies",
  "chronic_diseases",
  "medical_history",
  "previous_surgeries",
]);

const TEXT_FIELDS = [
  "allergies",
  "chronic_diseases",
  "medical_history",
  "previous_surgeries",
];

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function isPositiveInteger(value) {
  const stringValue =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : value;

  return (
    typeof stringValue === "string" &&
    /^[1-9][0-9]*$/.test(stringValue) &&
    BigInt(stringValue) <= MAX_UNSIGNED_BIGINT
  );
}

function validatePatientId(req, res, next) {
  const patientId = req.params.patientId;

  if (!isPositiveInteger(patientId)) {
    return validationFailure(res, {
      patientId: "patientId must be a positive integer",
    });
  }

  req.validatedPatientId = patientId;
  return next();
}

function validateMedicalRecordFields(
  input,
  { requireAtLeastOne = false } = {},
) {
  const errors = {};

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      body: "request body must be a JSON object",
    };
  }

  const inputFields = Object.keys(input);

  if (requireAtLeastOne && inputFields.length === 0) {
    return {
      body: "At least one medical record field is required",
    };
  }

  for (const field of inputFields) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "blood_type")) {
    if (input.blood_type !== null && typeof input.blood_type !== "string") {
      errors.blood_type = "blood_type must be a string or null";
    } else if (
      typeof input.blood_type === "string" &&
      input.blood_type.trim().length > BLOOD_TYPE_MAX_LENGTH
    ) {
      errors.blood_type = "blood_type must not exceed 5 characters";
    }
  }

  for (const field of TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      continue;
    }

    if (input[field] !== null && typeof input[field] !== "string") {
      errors[field] = `${field} must be a string or null`;
    } else if (
      typeof input[field] === "string" &&
      Buffer.byteLength(input[field], "utf8") > TEXT_MAX_BYTES
    ) {
      errors[field] = `${field} must not exceed 65535 bytes`;
    }
  }

  return errors;
}

function buildValidatedMedicalRecord(input) {
  const validated = {};

  for (const field of ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      continue;
    }

    validated[field] = input[field] === null ? null : input[field].trim();
  }

  return validated;
}

function validateCreateMedicalRecord(req, res, next) {
  const input = req.body;
  const errors = validateMedicalRecordFields(input);

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedMedicalRecord = buildValidatedMedicalRecord(input);
  return next();
}

function validateUpdateMedicalRecord(req, res, next) {
  const input = req.body;
  const errors = validateMedicalRecordFields(input, {
    requireAtLeastOne: true,
  });

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedMedicalRecordUpdate = buildValidatedMedicalRecord(input);
  return next();
}

module.exports = {
  validateCreateMedicalRecord,
  validatePatientId,
  validateUpdateMedicalRecord,
};
