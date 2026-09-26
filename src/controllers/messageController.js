const messageService = require("../services/messageService");

function handleMessageError(error, res) {
  if (error instanceof messageService.MessageForbiddenError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof messageService.MessageNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Messaging error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function send(req, res) {
  try {
    const message = await messageService.sendMessage(
      req.user,
      req.validatedMessage,
    );

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: { message },
    });
  } catch (error) {
    return handleMessageError(error, res);
  }
}

async function listConversations(req, res) {
  try {
    const conversations = await messageService.listConversations(req.user);

    return res.status(200).json({
      success: true,
      message: "Conversations retrieved successfully",
      data: { conversations },
    });
  } catch (error) {
    return handleMessageError(error, res);
  }
}

async function getHistory(req, res) {
  try {
    const messages = await messageService.getConversationHistory(
      req.user,
      req.validatedConversationUserId,
    );

    return res.status(200).json({
      success: true,
      message: "Conversation history retrieved successfully",
      data: { messages },
    });
  } catch (error) {
    return handleMessageError(error, res);
  }
}

async function markRead(req, res) {
  try {
    const message = await messageService.markMessageRead(
      req.user,
      req.validatedMessageId,
    );

    return res.status(200).json({
      success: true,
      message: "Message marked as read successfully",
      data: { message },
    });
  } catch (error) {
    return handleMessageError(error, res);
  }
}

module.exports = {
  getHistory,
  listConversations,
  markRead,
  send,
};
