const express = require("express");
const joinRequestController = require("../controllers/adminJoinRequestController");
const assignmentController = require("../controllers/adminDoctorPatientAssignmentController");
const emergencyAlertController = require("../controllers/emergencyAlertController");
const assistanceRequestController = require("../controllers/assistanceRequestController");
const resourceAllocationController = require("../controllers/resourceAllocationController");
const activityLogController = require("../controllers/activityLogController");
const systemSettingController = require("../controllers/systemSettingController");
const dashboardReportController = require("../controllers/dashboardReportController");
const patientIntakeController = require("../controllers/patientIntakeController");
const adminDoctorWorkloadController = require("../controllers/adminDoctorWorkloadController");
const intakeCorrectionRequestController = require("../controllers/intakeCorrectionRequestController");
const userManagementController = require("../controllers/userManagementController");
const authenticate = require("../middleware/authenticate");
const { validatePagination } = require("../utils/pagination");
const {
  validateUserListQuery,
  validateNgoListQuery,
  validateUserId,
  validateAccountStatusUpdate,
} = require("../middleware/validateUserManagement");
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
  validateIntakeId,
} = require("../middleware/validatePatientIntake");
const {
  validateCorrectionRequestId,
  validateResolveCorrectionRequest,
} = require("../middleware/validateIntakeCorrectionRequest");
const {
  validateDoctorId,
  validateDoctorWorkloadUpdate,
} = require("../middleware/validateDoctorWorkload");
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

// Admin lists page only when the client asks (?page / ?limit). Without them
// the full list is returned as before, because the admin dashboard still
// counts pending items from these lists in the browser.
const optionalPagination = validatePagination({ defaultLimit: 20, optional: true });

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

router.get(
  "/patient-intakes",
  optionalPagination,
  patientIntakeController.listForAdmin,
);
router.patch(
  "/patient-intakes/:intakeId/start-review",
  validateIntakeId,
  patientIntakeController.startReview,
);

router.get("/active-doctors", adminDoctorWorkloadController.listActive);
router.patch(
  "/doctors/:doctorId/workload",
  validateDoctorId,
  validateDoctorWorkloadUpdate,
  adminDoctorWorkloadController.updateWorkload,
);

router.get(
  "/intake-correction-requests",
  intakeCorrectionRequestController.listForAdmin,
);
router.patch(
  "/intake-correction-requests/:requestId/resolve",
  validateCorrectionRequestId,
  validateResolveCorrectionRequest,
  intakeCorrectionRequestController.resolveForAdmin,
);

router.get(
  "/doctor-patient-assignments",
  optionalPagination,
  assignmentController.list,
);
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

router.get(
  "/emergency-alerts",
  optionalPagination,
  emergencyAlertController.listForAdmin,
);

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
  optionalPagination,
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

// ==============================
// User and Organization Management (FR-10.1, FR-10.2)
// ==============================

router.get("/users", validateUserListQuery, userManagementController.listUsers);

router.patch(
  "/users/:userId/status",
  validateUserId,
  validateAccountStatusUpdate,
  userManagementController.updateUserStatus,
);

router.get("/ngos", validateNgoListQuery, userManagementController.listNgos);

module.exports = router;
