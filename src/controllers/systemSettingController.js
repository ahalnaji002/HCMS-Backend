const systemSettingService = require("../services/systemSettingService");

async function list(req, res) {
  const settings = await systemSettingService.listSettings();
  return res.status(200).json({
    success: true,
    message: "System Settings retrieved successfully",
    data: { settings },
  });
}

async function show(req, res) {
  const setting = await systemSettingService.getSetting(req.params.key);
  return res.status(200).json({
    success: true,
    message: "System Setting retrieved successfully",
    data: { setting },
  });
}

async function update(req, res) {
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
}

module.exports = { list, show, update };
