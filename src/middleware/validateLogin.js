const { isValidEmail } = require("../utils/registrationValidation");

function validateLogin(req, res, next) {
  const input = req.body || {};
  const email = typeof input.email === "string" ? input.email.trim() : input.email;
  const errors = {};

  if (!isValidEmail(email)) {
    errors.email = "email must be a valid email address";
  } else if (email.length > 255) {
    errors.email = "email must not exceed 255 characters";
  }

  if (typeof input.password !== "string" || input.password.length === 0) {
    errors.password = "password is required and must be a non-empty string";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.validatedLogin = { email, password: input.password };
  return next();
}

module.exports = validateLogin;
