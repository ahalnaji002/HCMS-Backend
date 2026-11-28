const db = require("../config/database");
const { paginateQuery } = require("../utils/pagination");

const MESSAGE_COLUMNS = [
  "id",
  "sender_id",
  "receiver_id",
  "message_text",
  "is_read",
  "sent_at",
  "read_at",
  "created_at",
];

function selectMessageColumns(query, alias = "messages") {
  return query.select(
    MESSAGE_COLUMNS.map((column) => `${alias}.${column}`),
  );
}

function findById(id, connection = db) {
  return selectMessageColumns(connection("messages"))
    .where("messages.id", id)
    .first();
}

async function create(message, connection = db) {
  const [id] = await connection("messages").insert({
    sender_id: message.sender_id,
    receiver_id: message.receiver_id,
    message_text: message.message_text,
    is_read: false,
    read_at: null,
  });

  return findById(id, connection);
}

function whereBetweenUsers(builder, userId, otherUserId) {
  builder.where((pair) => {
    pair
      .where({ sender_id: userId, receiver_id: otherUserId })
      .orWhere({ sender_id: otherUserId, receiver_id: userId });
  });
}

// One page of a conversation. Page 1 is the newest `limit` messages; each
// page is returned oldest first so it reads top to bottom.
async function listBetweenUsers(userId, otherUserId, { page, limit }, connection = db) {
  const query = selectMessageColumns(connection("messages"))
    .modify(whereBetweenUsers, userId, otherUserId)
    .orderBy("sent_at", "desc")
    .orderBy("id", "desc");
  const { items, total } = await paginateQuery(query, { page, limit });

  return { messages: items.reverse(), total };
}

// Latest message per conversation partner, newest conversation first.
// Picked in SQL (ROW_NUMBER per partner) so only one row per partner is read
// into memory instead of every message the user ever sent or received.
async function listConversationSummaries(userId, connection = db) {
  const ranked = connection("messages")
    .select(
      ...MESSAGE_COLUMNS,
      connection.raw(
        "CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS participant_id",
        [userId],
      ),
      connection.raw(
        "ROW_NUMBER() OVER (PARTITION BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END ORDER BY sent_at DESC, id DESC) AS row_rank",
        [userId],
      ),
    )
    .where("sender_id", userId)
    .orWhere("receiver_id", userId)
    .as("ranked");

  const rows = await connection
    .from(ranked)
    .join("users", "users.id", "ranked.participant_id")
    .select(
      ...MESSAGE_COLUMNS.map((column) => `ranked.${column}`),
      "users.id as participant_user_id",
      "users.full_name as participant_full_name",
      "users.role as participant_role",
    )
    .where("ranked.row_rank", 1)
    .orderBy("ranked.sent_at", "desc")
    .orderBy("ranked.id", "desc");

  return rows.map((row) => ({
    participant: {
      id: row.participant_user_id,
      full_name: row.participant_full_name,
      role: row.participant_role,
    },
    last_message: Object.fromEntries(
      MESSAGE_COLUMNS.map((column) => [column, row[column]]),
    ),
  }));
}

async function markReadByIdAndReceiverId(
  messageId,
  receiverId,
  connection = db,
) {
  await connection("messages")
    .where({ id: messageId, receiver_id: receiverId, is_read: false })
    .update({
      is_read: true,
      read_at: connection.fn.now(),
    });

  return findById(messageId, connection);
}

module.exports = {
  create,
  findById,
  listBetweenUsers,
  listConversationSummaries,
  markReadByIdAndReceiverId,
};
