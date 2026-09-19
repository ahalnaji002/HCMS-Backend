const MAX_UNSIGNED_BIGINT = 18446744073709551615n;
const ASSIGNMENT_REASON_MAX_LENGTH = 255;
const NOTES_MAX_BYTES = 65535;

const ALLOWED_FIELDS = new Set([
  "doctor_id",
  "patient_id",
  "assignment_reason",
  "notes",
]);

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

function validateCreateAssignment(req, res, next) {
  const input = req.body;
  const errors = {};

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, {
      body: "request body must be a JSON object",
    });
  }

  for (const field of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (!isPositiveInteger(input.doctor_id)) {
    errors.doctor_id = "doctor_id must be a positive integer";
  }

  if (!isPositiveInteger(input.patient_id)) {
    errors.patient_id = "patient_id must be a positive integer";
  }

  if (
    input.assignment_reason !== undefined &&
    input.assignment_reason !== null
  ) {
    if (typeof input.assignment_reason !== "string") {
      errors.assignment_reason = "assignment_reason must be a string or null";
    } else if (
      input.assignment_reason.trim().length > ASSIGNMENT_REASON_MAX_LENGTH
    ) {
      errors.assignment_reason =
        "assignment_reason must not exceed 255 characters";
    }
  }

  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== "string") {
      errors.notes = "notes must be a string or null";
    } else if (Buffer.byteLength(input.notes, "utf8") > NOTES_MAX_BYTES) {
      errors.notes = "notes must not exceed 65535 bytes";
    }
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedAssignment = {
    doctor_id: String(input.doctor_id),
    patient_id: String(input.patient_id),
  };

  if (input.assignment_reason !== undefined) {
    req.validatedAssignment.assignment_reason =
      input.assignment_reason === null ? null : input.assignment_reason.trim();
  }

  if (input.notes !== undefined) {
    req.validatedAssignment.notes =
      input.notes === null ? null : input.notes.trim();
  }

  return next();
}

module.exports = {
  validateCreateAssignment,
};
