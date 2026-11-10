const messageService = require("../services/messageService");

async function send(req, res) {
  const message = await messageService.sendMessage(
    req.user,
    req.validatedMessage,
  );

  return res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: { message },
  });
}

async function listConversations(req, res) {
  const conversations = await messageService.listConversations(req.user);

  return res.status(200).json({
    success: true,
    message: "Conversations retrieved successfully",
    data: { conversations },
  });
}

async function getHistory(req, res) {
  const messages = await messageService.getConversationHistory(
    req.user,
    req.validatedConversationUserId,
  );

  return res.status(200).json({
    success: true,
    message: "Conversation history retrieved successfully",
    data: { messages },
  });
}

async function markRead(req, res) {
  const message = await messageService.markMessageRead(
    req.user,
    req.validatedMessageId,
  );

  return res.status(200).json({
    success: true,
    message: "Message marked as read successfully",
    data: { message },
  });
}

module.exports = {
  getHistory,
  listConversations,
  markRead,
  send,
};
