const notificationService = require("../services/notificationService");

async function list(req, res) {
  const notifications = await notificationService.listOwnNotifications(
    req.user,
  );

  return res.status(200).json({
    success: true,
    message: "Notifications retrieved successfully",
    data: { notifications },
  });
}

async function unreadCount(req, res) {
  const count = await notificationService.getOwnUnreadCount(req.user);

  return res.status(200).json({
    success: true,
    message: "Unread Notification count retrieved successfully",
    data: { unread_count: count },
  });
}

async function markRead(req, res) {
  const notification = await notificationService.markOwnNotificationRead(
    req.user,
    req.validatedNotificationId,
  );

  return res.status(200).json({
    success: true,
    message: "Notification marked as read successfully",
    data: { notification },
  });
}

async function markAllRead(req, res) {
  const updatedCount =
    await notificationService.markAllOwnNotificationsRead(req.user);

  return res.status(200).json({
    success: true,
    message: "Notifications marked as read successfully",
    data: { updated_count: updatedCount },
  });
}

module.exports = {
  list,
  markAllRead,
  markRead,
  unreadCount,
};
