const express = require("express");
const notificationController = require("../controllers/notificationController");
const authenticate = require("../middleware/authenticate");
const {
  validateEmptyBody,
  validateNotificationId,
} = require("../middleware/validateNotification");

const router = express.Router();

router.use(authenticate);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch(
  "/read-all",
  validateEmptyBody,
  notificationController.markAllRead,
);
router.patch(
  "/:notificationId/read",
  validateNotificationId,
  validateEmptyBody,
  notificationController.markRead,
);

module.exports = router;
