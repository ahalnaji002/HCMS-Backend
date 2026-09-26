const express = require("express");
const assistanceRequestController = require("../controllers/assistanceRequestController");
const resourceAllocationController = require("../controllers/resourceAllocationController");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  validateRequestId,
  validateUpdateStatus,
} = require("../middleware/validateAssistanceRequest");
const {
  validateCreateResourceAllocation,
  validateRequestId: validateResourceRequestId,
  validateResourceId,
  validateUpdateResourceAllocation,
} = require("../middleware/validateResourceAllocation");

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

router.post(
  "/assistance-requests/:requestId/resources",
  validateResourceRequestId,
  validateCreateResourceAllocation,
  resourceAllocationController.createForNgo,
);

router.get(
  "/assistance-requests/:requestId/resources",
  validateResourceRequestId,
  resourceAllocationController.listForNgo,
);

router.patch(
  "/assistance-requests/:requestId/resources/:resourceId",
  validateResourceRequestId,
  validateResourceId,
  validateUpdateResourceAllocation,
  resourceAllocationController.updateForNgo,
);

router.delete(
  "/assistance-requests/:requestId/resources/:resourceId",
  validateResourceRequestId,
  validateResourceId,
  resourceAllocationController.deleteForNgo,
);

module.exports = router;
