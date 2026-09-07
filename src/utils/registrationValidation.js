const BCRYPT_MAX_PASSWORD_BYTES = 72;
const PALESTINIAN_MOBILE_PATTERN = /^(059|056)[0-9]{7}$/;
const NATIONAL_ID_PATTERN = /^[1-9][0-9]{8}$/;
const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

// When a field has a defined real-world format, validate its actual format/length/type rather than only checking that it is present.
function isValidPalestinianPhone(value) {
  return typeof value === "string" && PALESTINIAN_MOBILE_PATTERN.test(value);
}

function isValidNationalId(value) {
  return typeof value === "string" && NATIONAL_ID_PATTERN.test(value);
}

function isValidDateOnly(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidEmail(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  if (Array.from(value).some((character) => character.trim() === "")) {
    return false;
  }

  const atIndex = value.indexOf("@");

  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) {
    return false;
  }

  const domain = value.slice(atIndex + 1);
  const dotIndex = domain.indexOf(".");

  return dotIndex > 0 && dotIndex < domain.length - 1;
}

function validatePasswordFields(input, errors) {
  if (typeof input.password !== "string" || input.password.length === 0) {
    errors.password = "password is required and must be a string";
  } else if (input.password.length < 8) {
    errors.password = "password must be at least 8 characters long";
  } else if (!/[A-Z]/.test(input.password)) {
    errors.password = "password must contain at least one uppercase letter";
  } else if (!/[a-z]/.test(input.password)) {
    errors.password = "password must contain at least one lowercase letter";
  } else if (!/[0-9]/.test(input.password)) {
    errors.password = "password must contain at least one digit";
  } else if (
    Buffer.byteLength(input.password, "utf8") > BCRYPT_MAX_PASSWORD_BYTES
  ) {
    errors.password = "password must not exceed 72 UTF-8 bytes";
  }

  if (typeof input.password_confirmation !== "string") {
    errors.password_confirmation =
      "password_confirmation is required and must be a string";
  } else if (input.password_confirmation !== input.password) {
    errors.password_confirmation =
      "password_confirmation must match password";
  }
}

function validateCommonRegistrationFields(input, errors) {
  if (typeof input.full_name !== "string" || input.full_name.trim() === "") {
    errors.full_name = "full_name must be a non-empty string";
  } else if (input.full_name.length > 150) {
    errors.full_name = "full_name must not exceed 150 characters";
  }

  if (!isValidEmail(input.email)) {
    errors.email = "email must be a valid email address";
  } else if (input.email.length > 255) {
    errors.email = "email must not exceed 255 characters";
  }

  validatePasswordFields(input, errors);

  if (
    input.phone !== undefined &&
    input.phone !== null &&
    !isValidPalestinianPhone(input.phone)
  ) {
    errors.phone =
      "phone must be exactly 10 digits and start with 059 or 056";
  }
}

module.exports = {
  isValidEmail,
  isValidDateOnly,
  isValidNationalId,
  isValidPalestinianPhone,
  validateCommonRegistrationFields,
  validatePasswordFields,
};
