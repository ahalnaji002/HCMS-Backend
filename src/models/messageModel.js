const db = require("../config/database");

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

function listBetweenUsers(userId, otherUserId, connection = db) {
  return selectMessageColumns(connection("messages"))
    .where((builder) => {
      builder
        .where({ sender_id: userId, receiver_id: otherUserId })
        .orWhere({ sender_id: otherUserId, receiver_id: userId });
    })
    .orderBy("sent_at", "asc")
    .orderBy("id", "asc");
}

async function listConversationSummaries(userId, connection = db) {
  const messages = await selectMessageColumns(connection("messages"))
    .where("sender_id", userId)
    .orWhere("receiver_id", userId)
    .orderBy("sent_at", "desc")
    .orderBy("id", "desc");

  const latestByParticipant = new Map();

  for (const message of messages) {
    const participantId =
      String(message.sender_id) === String(userId)
        ? message.receiver_id
        : message.sender_id;
    const key = String(participantId);

    if (!latestByParticipant.has(key)) {
      latestByParticipant.set(key, { participantId, message });
    }
  }

  const participantIds = [...latestByParticipant.values()].map(
    ({ participantId }) => participantId,
  );

  if (participantIds.length === 0) {
    return [];
  }

  const participants = await connection("users")
    .select(["id", "full_name", "role"])
    .whereIn("id", participantIds);
  const participantsById = new Map(
    participants.map((participant) => [String(participant.id), participant]),
  );

  return [...latestByParticipant.values()]
    .map(({ participantId, message }) => ({
      participant: participantsById.get(String(participantId)),
      last_message: message,
    }))
    .filter((conversation) => conversation.participant !== undefined);
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
