const express = require("express");
const joinRequestController = require("../controllers/adminJoinRequestController");
const assignmentController = require("../controllers/adminDoctorPatientAssignmentController");
const emergencyAlertController = require("../controllers/emergencyAlertController");
const assistanceRequestController = require("../controllers/assistanceRequestController");
const resourceAllocationController = require("../controllers/resourceAllocationController");
const activityLogController = require("../controllers/activityLogController");
const systemSettingController = require("../controllers/systemSettingController");
const dashboardReportController = require("../controllers/dashboardReportController");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

const {
  validateAlertId,
  validateAssignEmergencyAlert,
} = require("../middleware/validateEmergencyAlert");
const {
  validateApprovalBody,
  validateJoinRequestId,
  validateRejectionBody,
} = require("../middleware/validateJoinRequestReview");
const {
  validateAssignmentId,
  validateAssignmentStatusUpdate,
  validateCreateAssignment,
} = require("../middleware/validateDoctorPatientAssignment");
const {
  validateAssignNgo,
  validateRequestId,
} = require("../middleware/validateAssistanceRequest");
const {
  validateRequestId: validateResourceRequestId,
} = require("../middleware/validateResourceAllocation");
const {
  validateListQuery: validateActivityLogListQuery,
  validateLogId,
} = require("../middleware/validateActivityLog");
const {
  validateUpdate: validateSystemSettingUpdate,
} = require("../middleware/validateSystemSetting");
const {
  validateAssistanceRequestReportQuery,
  validateReportQuery,
} = require("../middleware/validateReportQuery");

const router = express.Router();

router.use(authenticate, authorizeRoles("ADMIN"));

// ==============================
// Dashboard and Reports
// ==============================

router.get("/dashboard", dashboardReportController.getAdminDashboard);
router.get(
  "/reports/patients",
  validateReportQuery,
  dashboardReportController.getPatientReport,
);
router.get(
  "/reports/treatment-plans",
  validateReportQuery,
  dashboardReportController.getTreatmentPlanReport,
);
router.get(
  "/reports/assistance-requests",
  validateAssistanceRequestReportQuery,
  dashboardReportController.getAssistanceRequestReport,
);

// ==============================
// Activity Logs
// ==============================

router.get(
  "/activity-logs",
  validateActivityLogListQuery,
  activityLogController.list,
);
router.get(
  "/activity-logs/:logId",
  validateLogId,
  activityLogController.show,
);

// ==============================
// System Settings
// ==============================

router.get("/settings", systemSettingController.list);
router.get("/settings/:key", systemSettingController.show);
router.patch(
  "/settings/:key",
  validateSystemSettingUpdate,
  systemSettingController.update,
);

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

router.get("/doctor-patient-assignments", assignmentController.list);
router.get(
  "/doctor-patient-assignments/:id",
  validateAssignmentId,
  assignmentController.show,
);
router.patch(
  "/doctor-patient-assignments/:id/status",
  validateAssignmentId,
  validateAssignmentStatusUpdate,
  assignmentController.updateStatus,
);
router.post(
  "/doctor-patient-assignments",
  validateCreateAssignment,
  assignmentController.create,
);

// ==============================
// Emergency Alerts
// ==============================

router.get("/emergency-alerts", emergencyAlertController.listForAdmin);

router.get(
  "/emergency-alerts/:alertId",
  validateAlertId,
  emergencyAlertController.getForAdmin,
);

router.patch(
  "/emergency-alerts/:alertId/assign",
  validateAlertId,
  validateAssignEmergencyAlert,
  emergencyAlertController.assignDoctor,
);

// ==============================
// Assistance Requests
// ==============================

router.get(
  "/assistance-requests",
  assistanceRequestController.listForAdmin,
);

router.get(
  "/assistance-requests/:requestId",
  validateRequestId,
  assistanceRequestController.getForAdmin,
);

router.patch(
  "/assistance-requests/:requestId/assign",
  validateRequestId,
  validateAssignNgo,
  assistanceRequestController.assignNgo,
);

router.get(
  "/assistance-requests/:requestId/resources",
  validateResourceRequestId,
  resourceAllocationController.listForAdmin,
);

module.exports = router;
