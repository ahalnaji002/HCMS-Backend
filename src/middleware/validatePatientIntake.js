const MAX_ID = 18446744073709551615n;
const MAX_TEXT_BYTES = 65535;
const ANSWERS = new Set(["YES", "NO", "UNKNOWN"]);

const TEXT_FIELDS = [
  "current_problem",
  "symptoms",
  "symptom_onset",
  "chronic_conditions_details",
  "medications_details",
  "allergies_details",
  "additional_information",
];

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

function validateIntakeId(req, res, next) {
  if (!isPositiveId(req.params.intakeId)) {
    return validationFailure(res, { intakeId: "intakeId must be a positive integer" });
  }
  req.validatedIntakeId = req.params.intakeId;
  return next();
}

function validateIntakePayload(req, res, next) {
  const input = req.body;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const allowed = new Set([
    "current_problem",
    "symptoms",
    "symptom_onset",
    "chronic_conditions_answer",
    "chronic_conditions_details",
    "medications_answer",
    "medications_details",
    "allergies_answer",
    "allergies_details",
    "additional_information",
  ]);
  const required = [
    "current_problem",
    "symptoms",
    "symptom_onset",
    "chronic_conditions_answer",
    "medications_answer",
    "allergies_answer",
  ];
  const errors = {};

  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) errors[field] = `${field} is not allowed`;
  }
  for (const field of required) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      errors[field] = `${field} is required`;
    }
  }

  for (const field of TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = input[field];
    const nullable = field.endsWith("_details") || field === "additional_information";
    if (nullable && value === null) continue;
    if (typeof value !== "string") {
      errors[field] = `${field} must be a string${nullable ? " or null" : ""}`;
    } else if (Buffer.byteLength(value, "utf8") > MAX_TEXT_BYTES) {
      errors[field] = `${field} must not exceed ${MAX_TEXT_BYTES} UTF-8 bytes`;
    } else if (!nullable && value.trim().length === 0) {
      errors[field] = `${field} must not be empty`;
    }
  }

  for (const field of [
    "chronic_conditions_answer",
    "medications_answer",
    "allergies_answer",
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, field) && !ANSWERS.has(input[field])) {
      errors[field] = `${field} must be YES, NO, or UNKNOWN`;
    }
  }

  const conditionalDetails = [
    ["chronic_conditions_answer", "chronic_conditions_details"],
    ["medications_answer", "medications_details"],
    ["allergies_answer", "allergies_details"],
  ];
  for (const [answerField, detailsField] of conditionalDetails) {
    if (
      input[answerField] === "YES" &&
      (typeof input[detailsField] !== "string" || input[detailsField].trim().length === 0)
    ) {
      errors[detailsField] = `${detailsField} is required when ${answerField} is YES`;
    }
  }

  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedPatientIntake = Object.fromEntries(
    [
      "current_problem",
      "symptoms",
      "symptom_onset",
      "chronic_conditions_answer",
      "chronic_conditions_details",
      "medications_answer",
      "medications_details",
      "allergies_answer",
      "allergies_details",
      "additional_information",
    ].map((field) => {
      const value = input[field];
      return [field, typeof value === "string" ? value.trim() || null : value ?? null];
    }),
  );
  return next();
}

module.exports = { validateIntakeId, validateIntakePayload };
