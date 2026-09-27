const systemSettingService = require("../services/systemSettingService");

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function validateUpdate(req, res, next) {
  if (!systemSettingService.APPROVED_SETTING_KEYS.includes(req.params.key)) {
    return next();
  }

  const input = req.body;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, {
      body: "request body must be a JSON object",
    });
  }

  const errors = {};
  for (const field of Object.keys(input)) {
    if (field !== "setting_value") {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(input, "setting_value")) {
    errors.setting_value = "setting_value is required";
  } else {
    try {
      req.validatedSystemSettingValue =
        systemSettingService.normalizeSettingValue(
          req.params.key,
          input.setting_value,
        );
    } catch (error) {
      errors.setting_value = error.message;
    }
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  return next();
}

module.exports = { validateUpdate };
