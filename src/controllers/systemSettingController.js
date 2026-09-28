const systemSettingService = require("../services/systemSettingService");

function handleSystemSettingError(error, res) {
  if (error instanceof systemSettingService.SystemSettingNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error instanceof systemSettingService.SystemSettingValidationError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: { setting_value: error.message },
    });
  }

  console.error("System Setting error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function list(req, res) {
  try {
    const settings = await systemSettingService.listSettings();
    return res.status(200).json({
      success: true,
      message: "System Settings retrieved successfully",
      data: { settings },
    });
  } catch (error) {
    return handleSystemSettingError(error, res);
  }
}

async function show(req, res) {
  try {
    const setting = await systemSettingService.getSetting(req.params.key);
    return res.status(200).json({
      success: true,
      message: "System Setting retrieved successfully",
      data: { setting },
    });
  } catch (error) {
    return handleSystemSettingError(error, res);
  }
}

async function update(req, res) {
  try {
    const setting = await systemSettingService.updateSetting(
      req.params.key,
      req.validatedSystemSettingValue,
      req.user.id,
      req.ip,
    );
    return res.status(200).json({
      success: true,
      message: "System Setting updated successfully",
      data: { setting },
    });
  } catch (error) {
    return handleSystemSettingError(error, res);
  }
}

module.exports = { list, show, update };
