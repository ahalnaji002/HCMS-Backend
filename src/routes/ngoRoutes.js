const express = require("express");
const assistanceRequestController = require("../controllers/assistanceRequestController");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  validateRequestId,
  validateUpdateStatus,
} = require("../middleware/validateAssistanceRequest");

const router = express.Router();

router.use(authenticate, authorizeRoles("NGO"));

router.get(
  "/assistance-requests",
  assistanceRequestController.listForNgo,
);

router.get(
  "/assistance-requests/:requestId",
  validateRequestId,
  assistanceRequestController.getForNgo,
);

router.patch(
  "/assistance-requests/:requestId/status",
  validateRequestId,
  validateUpdateStatus,
  assistanceRequestController.updateStatusForNgo,
);

module.exports = router;
