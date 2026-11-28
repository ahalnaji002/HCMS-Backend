const express = require("express");
const notificationController = require("../controllers/notificationController");
const authenticate = require("../middleware/authenticate");
const { validatePagination } = require("../utils/pagination");
const {
  validateEmptyBody,
  validateNotificationId,
} = require("../middleware/validateNotification");

const router = express.Router();

const NOTIFICATION_PAGE_SIZE = 50;

router.use(authenticate);

router.get(
  "/",
  validatePagination({ defaultLimit: NOTIFICATION_PAGE_SIZE }),
  notificationController.list,
);
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
