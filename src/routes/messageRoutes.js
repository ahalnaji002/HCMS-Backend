const express = require("express");
const messageController = require("../controllers/messageController");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  validateConversationUserId,
  validateMarkRead,
  validateMessageId,
  validateSendMessage,
} = require("../middleware/validateMessage");

const router = express.Router();

router.use(authenticate, authorizeRoles("PATIENT", "DOCTOR"));

router.post("/", validateSendMessage, messageController.send);
router.get("/conversations", messageController.listConversations);
router.get(
  "/conversations/:userId",
  validateConversationUserId,
  messageController.getHistory,
);
router.patch(
  "/:messageId/read",
  validateMessageId,
  validateMarkRead,
  messageController.markRead,
);

module.exports = router;
