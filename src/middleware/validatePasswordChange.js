const { validatePasswordFields } = require("../utils/registrationValidation");

const ALLOWED_FIELDS = new Set([
  "current_password",
  "new_password",
  "new_password_confirmation",
]);

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

// Body: { current_password, new_password, new_password_confirmation }.
// The new password follows the registration policy (8+ characters, upper,
// lower, digit, at most 72 UTF-8 bytes) and must differ from the current one.
function validatePasswordChange(req, res, next) {
  const body = req.body;

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const errors = {};

  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) errors[field] = `${field} is not allowed`;
  }

  if (typeof body.current_password !== "string" || body.current_password.length === 0) {
    errors.current_password = "current_password is required and must be a non-empty string";
  }

  const policyErrors = {};
  validatePasswordFields(
    {
      password: body.new_password,
      password_confirmation: body.new_password_confirmation,
    },
    policyErrors,
  );
  if (policyErrors.password) {
    errors.new_password = policyErrors.password.replace(/^password/, "new_password");
  }
  if (policyErrors.password_confirmation) {
    errors.new_password_confirmation = policyErrors.password_confirmation
      .replace(/^password_confirmation/, "new_password_confirmation")
      .replace(/match password$/, "match new_password");
  }

  if (
    !errors.new_password &&
    typeof body.current_password === "string" &&
    body.new_password === body.current_password
  ) {
    errors.new_password = "new_password must be different from current_password";
  }

  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedPasswordChange = {
    currentPassword: body.current_password,
    newPassword: body.new_password,
  };
  return next();
}

module.exports = validatePasswordChange;
