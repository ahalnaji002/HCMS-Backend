const db = require("../config/database");

const NOTIFICATION_COLUMNS = [
  "id",
  "user_id",
  "title",
  "message",
  "type",
  "is_read",
  "reference_type",
  "reference_id",
  "created_at",
  "read_at",
];

function findByIdAndUserId(notificationId, userId, connection = db) {
  return connection("notifications")
    .select(NOTIFICATION_COLUMNS)
    .where({ id: notificationId, user_id: userId })
    .first();
}

async function create(notification, connection = db) {
  const [id] = await connection("notifications").insert({
    user_id: notification.user_id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    is_read: false,
    reference_type: notification.reference_type,
    reference_id: notification.reference_id,
    read_at: null,
  });

  return findByIdAndUserId(id, notification.user_id, connection);
}

function listByUserId(userId, connection = db) {
  return connection("notifications")
    .select(NOTIFICATION_COLUMNS)
    .where({ user_id: userId })
    .orderBy("created_at", "desc")
    .orderBy("id", "desc");
}

async function countUnreadByUserId(userId, connection = db) {
  const result = await connection("notifications")
    .where({ user_id: userId, is_read: false })
    .count({ count: "id" })
    .first();

  return Number(result.count);
}

async function markReadByIdAndUserId(
  notificationId,
  userId,
  connection = db,
) {
  await connection("notifications")
    .where({ id: notificationId, user_id: userId, is_read: false })
    .update({
      is_read: true,
      read_at: connection.fn.now(),
    });

  return findByIdAndUserId(notificationId, userId, connection);
}

function markAllReadByUserId(userId, connection = db) {
  return connection("notifications")
    .where({ user_id: userId, is_read: false })
    .update({
      is_read: true,
      read_at: connection.fn.now(),
    });
}

module.exports = {
  countUnreadByUserId,
  create,
  findByIdAndUserId,
  listByUserId,
  markAllReadByUserId,
  markReadByIdAndUserId,
};
