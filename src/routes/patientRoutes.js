const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const medicalRecordController = require("../controllers/medicalRecordController");

const treatmentPlanController = require("../controllers/treatmentPlanController");
const { validatePlanId } = require("../middleware/validateTreatmentPlan");
const treatmentMedicationController = require("../controllers/treatmentMedicationController");
const {
  validateMedicationId,
  validatePlanId: validateMedicationPlanId,
} = require("../middleware/validateTreatmentMedication");
const treatmentAppointmentController = require("../controllers/treatmentAppointmentController");
const {
  validateAppointmentId,
  validatePlanId: validateAppointmentPlanId,
} = require("../middleware/validateTreatmentAppointment");

const emergencyAlertController = require("../controllers/emergencyAlertController");
const {
  validateAlertId,
  validateCreateEmergencyAlert,
  validateCancelEmergencyAlert,
} = require("../middleware/validateEmergencyAlert");
const assistanceRequestController = require("../controllers/assistanceRequestController");
const resourceAllocationController = require("../controllers/resourceAllocationController");
const {
  validateRequestId,
} = require("../middleware/validateAssistanceRequest");
const {
  validateRequestId: validateResourceRequestId,
} = require("../middleware/validateResourceAllocation");
const reminderController = require("../controllers/reminderController");
const dashboardReportController = require("../controllers/dashboardReportController");
const patientIntakeController = require("../controllers/patientIntakeController");
const intakeCorrectionRequestController = require("../controllers/intakeCorrectionRequestController");
const doctorDiagnosisController = require("../controllers/doctorDiagnosisController");
const patientDoctorAssignmentController = require("../controllers/patientDoctorAssignmentController");
const {
  validateIntakePayload,
} = require("../middleware/validatePatientIntake");
const {
  validateCreateCorrectionRequest,
} = require("../middleware/validateIntakeCorrectionRequest");
const {
  validateCancelReminder,
  validateCreateReminder,
  validateReminderId,
} = require("../middleware/validateReminder");

const router = express.Router();

router.use(authenticate, authorizeRoles("PATIENT"));

router.get("/dashboard", dashboardReportController.getPatientDashboard);

router.get("/intake", patientIntakeController.getOwn);
router.post(
  "/intake",
  validateIntakePayload,
  patientIntakeController.createOwn,
);
router.put(
  "/intake",
  validateIntakePayload,
  patientIntakeController.updateOwn,
);

router.get("/doctor-assignments", patientDoctorAssignmentController.listOwn);

router.get("/diagnoses", doctorDiagnosisController.listOwn);
router.get(
  "/intake-correction-requests",
  intakeCorrectionRequestController.listOwn,
);
router.post(
  "/intake-correction-requests",
  validateCreateCorrectionRequest,
  intakeCorrectionRequestController.createOwn,
);

router.post(
  "/emergency-alerts",
  validateCreateEmergencyAlert,
  emergencyAlertController.createPatientAlert,
);

router.get("/emergency-alerts", emergencyAlertController.listOwnAlerts);

router.get(
  "/emergency-alerts/:alertId",
  validateAlertId,
  emergencyAlertController.getOwnAlert,
);

router.patch(
  "/emergency-alerts/:alertId/cancel",
  validateAlertId,
  validateCancelEmergencyAlert,
  emergencyAlertController.cancelOwnAlert,
);

router.post(
  "/reminders",
  validateCreateReminder,
  reminderController.create,
);

router.get("/reminders", reminderController.list);

router.get(
  "/reminders/:reminderId",
  validateReminderId,
  reminderController.get,
);

router.patch(
  "/reminders/:reminderId/cancel",
  validateReminderId,
  validateCancelReminder,
  reminderController.cancel,
);

router.get(
  "/assistance-requests",
  assistanceRequestController.listOwnRequests,
);

router.get(
  "/assistance-requests/:requestId",
  validateRequestId,
  assistanceRequestController.getOwnRequest,
);

router.get(
  "/assistance-requests/:requestId/resources",
  validateResourceRequestId,
  resourceAllocationController.listForPatient,
);

router.get("/medical-record", medicalRecordController.getOwnMedicalRecord);

router.get("/treatment-plans", treatmentPlanController.listOwnTreatmentPlans);

router.get(
  "/treatment-plans/:planId",
  validatePlanId,
  treatmentPlanController.getOwnTreatmentPlan,
);

router.get(
  "/treatment-plans/:planId/medications",
  validateMedicationPlanId,
  treatmentMedicationController.listForPatient,
);

router.get(
  "/treatment-plans/:planId/medications/:medicationId",
  validateMedicationPlanId,
  validateMedicationId,
  treatmentMedicationController.getForPatient,
);

router.get(
  "/treatment-plans/:planId/appointments",
  validateAppointmentPlanId,
  treatmentAppointmentController.listForPatient,
);

router.get(
  "/treatment-plans/:planId/appointments/:appointmentId",
  validateAppointmentPlanId,
  validateAppointmentId,
  treatmentAppointmentController.getForPatient,
);

module.exports = router;
