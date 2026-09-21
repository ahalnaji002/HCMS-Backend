const TEXT_MAX_BYTES = 65535;
const TITLE_MAX_LENGTH = 150;

const APPROVED_STATUSES = new Set(["ACTIVE", "COMPLETED", "CANCELLED"]);

const CREATE_FIELDS = new Set([
  "title",
  "general_instructions",
  "start_date",
  "end_date",
]);

const UPDATE_FIELDS = new Set([
  "title",
  "general_instructions",
  "status",
  "start_date",
  "end_date",
]);

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

const UNSIGNED_BIGINT_MAX = 18446744073709551615n;

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

function isValidDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validatePatientId(req, res, next) {
  if (!isValidPositiveId(req.params.patientId)) {
    return validationFailure(res, {
      patientId: "patientId must be a positive integer",
    });
  }

  return next();
}

function validatePlanId(req, res, next) {
  if (!isValidPositiveId(req.params.planId)) {
    return validationFailure(res, {
      planId: "planId must be a positive integer",
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

function validateAllowedFields(input, allowedFields, errors) {
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }
}

function validateTitle(value, errors, required = false) {
  if (value === undefined) {
    if (required) {
      errors.title = "title is required";
    }

    return;
  }

  if (typeof value !== "string") {
    errors.title = "title must be a string";
    return;
  }

  if (value.trim().length === 0) {
    errors.title = "title must not be empty";
    return;
  }

  if (value.length > TITLE_MAX_LENGTH) {
    errors.title = "title must not exceed 150 characters";
  }
}

function validateGeneralInstructions(value, errors) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors.general_instructions =
      "general_instructions must be a string or null";
    return;
  }

  if (Buffer.byteLength(value, "utf8") > TEXT_MAX_BYTES) {
    errors.general_instructions =
      "general_instructions must not exceed 65535 bytes";
  }
}

function validateStatus(value, errors) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || !APPROVED_STATUSES.has(value)) {
    errors.status = "status must be one of ACTIVE, COMPLETED, or CANCELLED";
  }
}

function validateStartDate(value, errors, required = false) {
  if (value === undefined) {
    if (required) {
      errors.start_date = "start_date is required";
    }

    return;
  }

  if (!isValidDate(value)) {
    errors.start_date = "start_date must be a valid date in YYYY-MM-DD format";
  }
}

function validateEndDate(value, errors) {
  if (value === undefined || value === null) {
    return;
  }

  if (!isValidDate(value)) {
    errors.end_date = "end_date must be a valid date in YYYY-MM-DD format";
  }
}

function validateCreateTreatmentPlan(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};

  validateAllowedFields(input, CREATE_FIELDS, errors);
  validateTitle(input.title, errors, true);
  validateGeneralInstructions(input.general_instructions, errors);
  validateStartDate(input.start_date, errors, true);
  validateEndDate(input.end_date, errors);

  if (
    !errors.start_date &&
    !errors.end_date &&
    input.start_date !== undefined &&
    input.end_date !== undefined &&
    input.end_date !== null &&
    input.end_date < input.start_date
  ) {
    errors.end_date = "end_date must be greater than or equal to start_date";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedTreatmentPlan = {
    title: input.title.trim(),
    start_date: input.start_date,
  };

  if (Object.prototype.hasOwnProperty.call(input, "general_instructions")) {
    req.validatedTreatmentPlan.general_instructions =
      input.general_instructions;
  }

  if (Object.prototype.hasOwnProperty.call(input, "end_date")) {
    req.validatedTreatmentPlan.end_date = input.end_date;
  }

  return next();
}

function validateUpdateTreatmentPlan(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};

  validateAllowedFields(input, UPDATE_FIELDS, errors);

  if (Object.keys(input).length === 0) {
    errors.body = "at least one editable field is required";
  }

  validateTitle(input.title, errors);
  validateGeneralInstructions(input.general_instructions, errors);
  validateStatus(input.status, errors);
  validateStartDate(input.start_date, errors);
  validateEndDate(input.end_date, errors);

  if (
    !errors.start_date &&
    !errors.end_date &&
    input.start_date !== undefined &&
    input.end_date !== undefined &&
    input.end_date !== null &&
    input.end_date < input.start_date
  ) {
    errors.end_date = "end_date must be greater than or equal to start_date";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  const validated = {};

  if (Object.prototype.hasOwnProperty.call(input, "title")) {
    validated.title = input.title.trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "general_instructions")) {
    validated.general_instructions = input.general_instructions;
  }

  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    validated.status = input.status;
  }

  if (Object.prototype.hasOwnProperty.call(input, "start_date")) {
    validated.start_date = input.start_date;
  }

  if (Object.prototype.hasOwnProperty.call(input, "end_date")) {
    validated.end_date = input.end_date;
  }

  req.validatedTreatmentPlan = validated;

  return next();
}

module.exports = {
  validatePatientId,
  validatePlanId,
  validateCreateTreatmentPlan,
  validateUpdateTreatmentPlan,
};
