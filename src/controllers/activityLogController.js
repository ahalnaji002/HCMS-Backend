const activityLogService = require("../services/activityLogService");

async function list(req, res) {
  const data = await activityLogService.listActivityLogs(
    req.validatedActivityLogQuery,
  );
  return res.status(200).json({
    success: true,
    message: "Activity Logs retrieved successfully",
    data,
  });
}

async function show(req, res) {
  const activityLog = await activityLogService.getActivityLog(
    req.validatedActivityLogId,
  );
  return res.status(200).json({
    success: true,
    message: "Activity Log retrieved successfully",
    data: { activity_log: activityLog },
  });
}

module.exports = {
  list,
  show,
};
