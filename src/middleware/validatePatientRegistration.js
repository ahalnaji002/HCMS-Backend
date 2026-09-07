const {
  isValidDateOnly,
  validateCommonRegistrationFields,
} = require("../utils/registrationValidation");

const FORBIDDEN_FIELDS = [
  "password_hash",
  "role",
  "account_status",
  "user_id",
  "id",
  "created_at",
  "updated_at",
];

function validatePatientRegistration(req, res, next) {
  const input = req.body || {};
  const errors = {};

  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  validateCommonRegistrationFields(input, errors);

  if (!isValidDateOnly(input.date_of_birth)) {
    errors.date_of_birth =
      "date_of_birth must be a valid date in YYYY-MM-DD format";
  }

  if (input.gender !== "MALE" && input.gender !== "FEMALE") {
    errors.gender = "gender must be exactly MALE or FEMALE";
  }

  if (input.address !== undefined) {
    if (typeof input.address !== "string") {
      errors.address = "address must be a string";
    } else if (input.address.length > 255) {
      errors.address = "address must not exceed 255 characters";
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.validatedPatientRegistration = {
    full_name: input.full_name,
    email: input.email,
    password: input.password,
    date_of_birth: input.date_of_birth,
    gender: input.gender,
  };

  if (input.phone !== undefined) {
    req.validatedPatientRegistration.phone = input.phone;
  }

  if (input.address !== undefined) {
    req.validatedPatientRegistration.address = input.address;
  }

  return next();
}

module.exports = validatePatientRegistration;
