const {
  isValidDateOnly,
  isValidPalestinianPhone,
} = require("../utils/registrationValidation");

const COMMON_ALLOWED_FIELDS = ["full_name", "phone"];

const ROLE_ALLOWED_FIELDS = {
  PATIENT: [...COMMON_ALLOWED_FIELDS, "date_of_birth", "gender", "address"],
  DOCTOR: [...COMMON_ALLOWED_FIELDS],
};

function validateProfileUpdate(req, res, next) {
  const input = req.body || {};
  const errors = {};

  const allowedFields = ROLE_ALLOWED_FIELDS[req.user.role];

  if (!allowedFields) {
    return res.status(403).json({
      success: false,
      message: "Profile update is not allowed for this role",
    });
  }

  const inputFields = Object.keys(input);

  if (inputFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: {
        body: "At least one profile field is required",
      },
    });
  }

  for (const field of inputFields) {
    if (!allowedFields.includes(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "full_name")) {
    if (typeof input.full_name !== "string" || input.full_name.trim() === "") {
      errors.full_name = "full_name must be a non-empty string";
    } else if (input.full_name.trim().length > 150) {
      errors.full_name = "full_name must not exceed 150 characters";
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "phone")) {
    if (input.phone !== null && !isValidPalestinianPhone(input.phone)) {
      errors.phone =
        "phone must be exactly 10 digits and start with 059 or 056";
    }
  }

  if (
    req.user.role === "PATIENT" &&
    Object.prototype.hasOwnProperty.call(input, "date_of_birth")
  ) {
    if (!isValidDateOnly(input.date_of_birth)) {
      errors.date_of_birth =
        "date_of_birth must be a valid date in YYYY-MM-DD format";
    } else {
      const today = new Date();
      const todayDateOnly = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");

      if (input.date_of_birth > todayDateOnly) {
        errors.date_of_birth = "date_of_birth must not be in the future";
      }
    }
  }

  if (
    req.user.role === "PATIENT" &&
    Object.prototype.hasOwnProperty.call(input, "gender") &&
    input.gender !== "MALE" &&
    input.gender !== "FEMALE"
  ) {
    errors.gender = "gender must be exactly MALE or FEMALE";
  }

  if (
    req.user.role === "PATIENT" &&
    Object.prototype.hasOwnProperty.call(input, "address")
  ) {
    if (input.address !== null && typeof input.address !== "string") {
      errors.address = "address must be a string";
    } else if (
      typeof input.address === "string" &&
      input.address.trim().length > 255
    ) {
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

  const validatedProfileUpdate = {};

  if (Object.prototype.hasOwnProperty.call(input, "full_name")) {
    validatedProfileUpdate.full_name = input.full_name.trim();
  }

  if (Object.prototype.hasOwnProperty.call(input, "phone")) {
    validatedProfileUpdate.phone = input.phone;
  }

  if (
    req.user.role === "PATIENT" &&
    Object.prototype.hasOwnProperty.call(input, "date_of_birth")
  ) {
    validatedProfileUpdate.date_of_birth = input.date_of_birth;
  }

  if (
    req.user.role === "PATIENT" &&
    Object.prototype.hasOwnProperty.call(input, "gender")
  ) {
    validatedProfileUpdate.gender = input.gender;
  }

  if (
    req.user.role === "PATIENT" &&
    Object.prototype.hasOwnProperty.call(input, "address")
  ) {
    validatedProfileUpdate.address =
      input.address === null ? null : input.address.trim();
  }

  req.validatedProfileUpdate = validatedProfileUpdate;

  return next();
}

module.exports = validateProfileUpdate;
