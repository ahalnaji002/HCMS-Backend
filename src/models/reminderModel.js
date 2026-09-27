const db = require("../config/database");

const REMINDER_COLUMNS = [
  "id",
  "user_id",
  "type",
  "reference_type",
  "reference_id",
  "remind_at",
  "status",
  "sent_at",
  "created_at",
  "updated_at",
];

async function create(reminder, connection = db) {
  const [id] = await connection("reminders").insert({
    user_id: reminder.user_id,
    type: reminder.type,
    reference_type: reminder.reference_type,
    reference_id: reminder.reference_id,
    remind_at: reminder.remind_at,
    status: "PENDING",
    sent_at: null,
  });

  return findByIdAndUserId(id, reminder.user_id, connection);
}

function findById(reminderId, connection = db) {
  return connection("reminders")
    .select(REMINDER_COLUMNS)
    .where({ id: reminderId })
    .first();
}

function findByIdAndUserId(reminderId, userId, connection = db) {
  return connection("reminders")
    .select(REMINDER_COLUMNS)
    .where({ id: reminderId, user_id: userId })
    .first();
}

function findByIdForUpdate(reminderId, connection) {
  return connection("reminders")
    .select(REMINDER_COLUMNS)
    .where({ id: reminderId })
    .forUpdate()
    .first();
}

function listByUserId(userId, connection = db) {
  return connection("reminders")
    .select(REMINDER_COLUMNS)
    .where({ user_id: userId })
    .orderBy("remind_at", "asc")
    .orderBy("id", "asc");
}

function listDuePendingIds(currentTime, connection = db) {
  return connection("reminders")
    .select("id")
    .where({ status: "PENDING" })
    .where("remind_at", "<=", currentTime)
    .orderBy("remind_at", "asc")
    .orderBy("id", "asc");
}

async function cancelPending(reminderId, userId, connection = db) {
  const affectedRows = await connection("reminders")
    .where({ id: reminderId, user_id: userId, status: "PENDING" })
    .update({
      status: "CANCELLED",
      updated_at: connection.fn.now(),
    });

  if (affectedRows === 0) {
    return null;
  }

  return findByIdAndUserId(reminderId, userId, connection);
}

async function markPendingSent(reminderId, currentTime, connection = db) {
  const affectedRows = await connection("reminders")
    .where({ id: reminderId, status: "PENDING" })
    .where("remind_at", "<=", currentTime)
    .update({
      status: "SENT",
      sent_at: connection.fn.now(),
      updated_at: connection.fn.now(),
    });

  if (affectedRows === 0) {
    return null;
  }

  return findById(reminderId, connection);
}

module.exports = {
  cancelPending,
  create,
  findById,
  findByIdAndUserId,
  findByIdForUpdate,
  listByUserId,
  listDuePendingIds,
  markPendingSent,
};
