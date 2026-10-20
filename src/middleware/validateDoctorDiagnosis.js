const MAX_TEXT_BYTES = 65535;

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function validateCreateDoctorDiagnosis(req, res, next) {
  const input = req.body;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const errors = {};
  for (const field of Object.keys(input)) {
    if (field !== "diagnosis") errors[field] = `${field} is not allowed`;
  }
  if (typeof input.diagnosis !== "string") {
    errors.diagnosis = "diagnosis is required and must be a string";
  } else if (input.diagnosis.trim().length === 0) {
    errors.diagnosis = "diagnosis must not be empty";
  } else if (Buffer.byteLength(input.diagnosis, "utf8") > MAX_TEXT_BYTES) {
    errors.diagnosis = `diagnosis must not exceed ${MAX_TEXT_BYTES} UTF-8 bytes`;
  }
  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedDoctorDiagnosis = input.diagnosis.trim();
  return next();
}

module.exports = { validateCreateDoctorDiagnosis };
