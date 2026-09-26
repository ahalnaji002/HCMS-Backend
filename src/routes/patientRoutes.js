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

const router = express.Router();

router.use(authenticate, authorizeRoles("PATIENT"));

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
