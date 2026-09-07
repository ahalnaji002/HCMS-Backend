const express = require("express");
const controller = require("../controllers/adminJoinRequestController");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  validateApprovalBody,
  validateJoinRequestId,
  validateRejectionBody,
} = require("../middleware/validateJoinRequestReview");

const router = express.Router();

router.use(authenticate, authorizeRoles("ADMIN"));

// ==============================
// Join Request Review
// ==============================

router.get("/join-requests", controller.listPending);
router.get(
  "/join-requests/:id",
  validateJoinRequestId,
  controller.show
);
router.patch(
  "/join-requests/:id/approve",
  validateJoinRequestId,
  validateApprovalBody,
  controller.approve
);
router.patch(
  "/join-requests/:id/reject",
  validateJoinRequestId,
  validateRejectionBody,
  controller.reject
);

module.exports = router;
