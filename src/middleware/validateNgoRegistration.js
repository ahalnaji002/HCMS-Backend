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
  "contact_phone",
  "created_at",
  "updated_at",
];

function validateNgoRegistration(req, res, next) {
  const input = req.body || {};
  const errors = {};

  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  const normalizedInput = {
    ...input,
    full_name:
      typeof input.full_name === "string"
        ? input.full_name.trim()
        : input.full_name,
    email: typeof input.email === "string" ? input.email.trim() : input.email,
  };

  validateCommonRegistrationFields(normalizedInput, errors);

  if (
    typeof input.organization_name !== "string" ||
    input.organization_name.trim() === ""
  ) {
    errors.organization_name =
      "organization_name must be a non-empty string";
  } else if (input.organization_name.trim().length > 150) {
    errors.organization_name =
      "organization_name must not exceed 150 characters";
  }

  if (input.registration_number !== undefined && input.registration_number !== null) {
    if (
      typeof input.registration_number !== "string" ||
      input.registration_number.trim() === ""
    ) {
      errors.registration_number =
        "registration_number must be a non-empty string";
    } else if (input.registration_number.trim().length > 100) {
      errors.registration_number =
        "registration_number must not exceed 100 characters";
    }
  }

  if (input.address !== undefined && input.address !== null) {
    if (typeof input.address !== "string") {
      errors.address = "address must be a string";
    } else if (input.address.trim().length > 255) {
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

  req.validatedNgoRegistration = {
    full_name: normalizedInput.full_name,
    email: normalizedInput.email,
    password: input.password,
    organization_name: input.organization_name.trim(),
  };

  if (input.registration_number !== undefined) {
    req.validatedNgoRegistration.registration_number =
      input.registration_number === null
        ? null
        : input.registration_number.trim();
  }

  if (input.phone !== undefined) {
    req.validatedNgoRegistration.phone = input.phone;
  }

  if (input.address !== undefined) {
    req.validatedNgoRegistration.address =
      input.address === null ? null : input.address.trim();
  }

  return next();
}

module.exports = validateNgoRegistration;
