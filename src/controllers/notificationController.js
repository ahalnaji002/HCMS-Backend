const notificationService = require("../services/notificationService");

function handleNotificationError(error, res) {
  if (error instanceof notificationService.NotificationValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof notificationService.NotificationNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Notification error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function list(req, res) {
  try {
    const notifications = await notificationService.listOwnNotifications(
      req.user,
    );

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: { notifications },
    });
  } catch (error) {
    return handleNotificationError(error, res);
  }
}

async function unreadCount(req, res) {
  try {
    const count = await notificationService.getOwnUnreadCount(req.user);

    return res.status(200).json({
      success: true,
      message: "Unread Notification count retrieved successfully",
      data: { unread_count: count },
    });
  } catch (error) {
    return handleNotificationError(error, res);
  }
}

async function markRead(req, res) {
  try {
    const notification = await notificationService.markOwnNotificationRead(
      req.user,
      req.validatedNotificationId,
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read successfully",
      data: { notification },
    });
  } catch (error) {
    return handleNotificationError(error, res);
  }
}

async function markAllRead(req, res) {
  try {
    const updatedCount =
      await notificationService.markAllOwnNotificationsRead(req.user);

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read successfully",
      data: { updated_count: updatedCount },
    });
  } catch (error) {
    return handleNotificationError(error, res);
  }
}

module.exports = {
  list,
  markAllRead,
  markRead,
  unreadCount,
};
