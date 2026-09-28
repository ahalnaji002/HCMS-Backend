const activityLogService = require("../services/activityLogService");

function handleActivityLogError(error, res) {
  if (error instanceof activityLogService.ActivityLogNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }

  console.error("Activity Log error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function list(req, res) {
  try {
    const data = await activityLogService.listActivityLogs(
      req.validatedActivityLogQuery,
    );
    return res.status(200).json({
      success: true,
      message: "Activity Logs retrieved successfully",
      data,
    });
  } catch (error) {
    return handleActivityLogError(error, res);
  }
}

async function show(req, res) {
  try {
    const activityLog = await activityLogService.getActivityLog(
      req.validatedActivityLogId,
    );
    return res.status(200).json({
      success: true,
      message: "Activity Log retrieved successfully",
      data: { activity_log: activityLog },
    });
  } catch (error) {
    return handleActivityLogError(error, res);
  }
}

module.exports = {
  list,
  show,
};
