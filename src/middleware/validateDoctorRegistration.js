const {
  validateCommonRegistrationFields,
} = require("../utils/registrationValidation");

const FORBIDDEN_FIELDS = [
  "password_hash",
  "role",
  "account_status",
  "user_id",
  "id",
  "request_type",
  "status",
  "reviewed_by_admin_id",
  "reviewed_at",
  "rejection_reason",
  "created_at",
  "updated_at",
];

function validateDoctorRegistration(req, res, next) {
  const input = req.body || {};
  const errors = {};

  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  validateCommonRegistrationFields(input, errors);

  if (
    typeof input.specialization !== "string" ||
    input.specialization.trim() === ""
  ) {
    errors.specialization = "specialization must be a non-empty string";
  } else if (input.specialization.length > 100) {
    errors.specialization = "specialization must not exceed 100 characters";
  }

  if (
    typeof input.license_number !== "string" ||
    input.license_number.trim() === ""
  ) {
    errors.license_number = "license_number must be a non-empty string";
  } else if (input.license_number.length > 100) {
    errors.license_number = "license_number must not exceed 100 characters";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.validatedDoctorRegistration = {
    full_name: input.full_name,
    email: input.email,
    password: input.password,
    specialization: input.specialization,
    license_number: input.license_number,
  };

  if (input.phone !== undefined) {
    req.validatedDoctorRegistration.phone = input.phone;
  }

  return next();
}

module.exports = validateDoctorRegistration;
