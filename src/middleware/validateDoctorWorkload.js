const MAX_ID = 18446744073709551615n;
const MAX_CAPACITY = 4294967295;

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

function validateDoctorId(req, res, next) {
  if (!isPositiveId(req.params.doctorId)) {
    return validationFailure(res, { doctorId: "doctorId must be a positive integer" });
  }
  req.validatedDoctorId = req.params.doctorId;
  return next();
}

function validateDoctorWorkloadUpdate(req, res, next) {
  const input = req.body;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const errors = {};
  const fields = Object.keys(input);
  for (const field of fields) {
    if (field !== "availability" && field !== "capacity_limit") {
      errors[field] = `${field} is not allowed`;
    }
  }
  if (fields.length === 0) errors.body = "At least one workload field is required";
  if (
    input.availability !== undefined &&
    input.availability !== "AVAILABLE" &&
    input.availability !== "UNAVAILABLE"
  ) {
    errors.availability = "availability must be AVAILABLE or UNAVAILABLE";
  }
  if (
    input.capacity_limit !== undefined &&
    input.capacity_limit !== null &&
    (!Number.isInteger(input.capacity_limit) ||
      input.capacity_limit < 0 ||
      input.capacity_limit > MAX_CAPACITY)
  ) {
    errors.capacity_limit = `capacity_limit must be null or an integer from 0 to ${MAX_CAPACITY}`;
  }
  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedDoctorWorkload = {};
  if (input.availability !== undefined) {
    req.validatedDoctorWorkload.availability = input.availability;
  }
  if (input.capacity_limit !== undefined) {
    req.validatedDoctorWorkload.capacity_limit = input.capacity_limit;
  }
  return next();
}

module.exports = { validateDoctorId, validateDoctorWorkloadUpdate };
