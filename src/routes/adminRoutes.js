const express = require("express");
const joinRequestController = require("../controllers/adminJoinRequestController");
const assignmentController = require("../controllers/adminDoctorPatientAssignmentController");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  validateApprovalBody,
  validateJoinRequestId,
  validateRejectionBody,
} = require("../middleware/validateJoinRequestReview");
const {
  validateCreateAssignment,
} = require("../middleware/validateDoctorPatientAssignment");

const router = express.Router();

router.use(authenticate, authorizeRoles("ADMIN"));

// ==============================
// Join Request Review
// ==============================

router.get("/join-requests", joinRequestController.listPending);
router.get(
  "/join-requests/:id",
  validateJoinRequestId,
  joinRequestController.show,
);
router.patch(
  "/join-requests/:id/approve",
  validateJoinRequestId,
  validateApprovalBody,
  joinRequestController.approve,
);
router.patch(
  "/join-requests/:id/reject",
  validateJoinRequestId,
  validateRejectionBody,
  joinRequestController.reject,
);

// ==============================
// Doctor-Patient Assignments
// ==============================

router.post(
  "/doctor-patient-assignments",
  validateCreateAssignment,
  assignmentController.create,
);

module.exports = router;
