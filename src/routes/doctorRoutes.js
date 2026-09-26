const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const medicalRecordController = require("../controllers/medicalRecordController");
const medicalNoteController = require("../controllers/medicalNoteController");
const treatmentPlanController = require("../controllers/treatmentPlanController");
const treatmentMedicationController = require("../controllers/treatmentMedicationController");
const treatmentAppointmentController = require("../controllers/treatmentAppointmentController");
const doctorAssignedPatientController = require("../controllers/doctorAssignedPatientController");
const assistanceRequestController = require("../controllers/assistanceRequestController");
const resourceAllocationController = require("../controllers/resourceAllocationController");

const {
  validateCreateAssistanceRequest,
  validatePatientId: validateAssistanceRequestPatientId,
} = require("../middleware/validateAssistanceRequest");
const {
  validateRequestId: validateResourceRequestId,
} = require("../middleware/validateResourceAllocation");

const {
  validateCreateMedicalRecord,
  validatePatientId,
  validateUpdateMedicalRecord,
} = require("../middleware/validateMedicalRecord");

const {
  validateCreateMedicalNote,
} = require("../middleware/validateMedicalNote");

const {
  validatePatientId: validateTreatmentPlanPatientId,
  validatePlanId,
  validateCreateTreatmentPlan,
  validateUpdateTreatmentPlan,
} = require("../middleware/validateTreatmentPlan");
const {
  validateCreateTreatmentMedication,
  validateMedicationId,
  validatePlanId: validateMedicationPlanId,
  validateUpdateTreatmentMedication,
} = require("../middleware/validateTreatmentMedication");
const {
  validateAppointmentId,
  validateCreateTreatmentAppointment,
  validatePlanId: validateAppointmentPlanId,
  validateUpdateTreatmentAppointment,
} = require("../middleware/validateTreatmentAppointment");

const router = express.Router();

router.use(authenticate, authorizeRoles("DOCTOR"));

router.get("/patients", doctorAssignedPatientController.list);

router.get(
  "/patients/:patientId",
  validatePatientId,
  doctorAssignedPatientController.show,
);

router.post(
  "/patients/:patientId/assistance-requests",
  validateAssistanceRequestPatientId,
  validateCreateAssistanceRequest,
  assistanceRequestController.createForAssignedPatient,
);

router.get(
  "/assistance-requests/:requestId/resources",
  validateResourceRequestId,
  resourceAllocationController.listForDoctor,
);

router.post(
  "/patients/:patientId/medical-record",
  validatePatientId,
  validateCreateMedicalRecord,
  medicalRecordController.createForAssignedPatient,
);

router.get(
  "/patients/:patientId/medical-record",
  validatePatientId,
  medicalRecordController.getForAssignedPatient,
);

router.patch(
  "/patients/:patientId/medical-record",
  validatePatientId,
  validateUpdateMedicalRecord,
  medicalRecordController.updateForAssignedPatient,
);

router.post(
  "/patients/:patientId/medical-notes",
  validatePatientId,
  validateCreateMedicalNote,
  medicalNoteController.createForAssignedPatient,
);

router.get(
  "/patients/:patientId/medical-notes",
  validatePatientId,
  medicalNoteController.listForAssignedPatient,
);

router.post(
  "/patients/:patientId/treatment-plans",
  validateTreatmentPlanPatientId,
  validateCreateTreatmentPlan,
  treatmentPlanController.createForAssignedPatient,
);

router.get(
  "/patients/:patientId/treatment-plans",
  validateTreatmentPlanPatientId,
  treatmentPlanController.listForAssignedPatient,
);

router.get(
  "/patients/:patientId/treatment-plans/:planId",
  validateTreatmentPlanPatientId,
  validatePlanId,
  treatmentPlanController.getForAssignedPatient,
);

router.patch(
  "/patients/:patientId/treatment-plans/:planId",
  validateTreatmentPlanPatientId,
  validatePlanId,
  validateUpdateTreatmentPlan,
  treatmentPlanController.updateForAssignedPatient,
);

router.post(
  "/treatment-plans/:planId/medications",
  validateMedicationPlanId,
  validateCreateTreatmentMedication,
  treatmentMedicationController.create,
);

router.get(
  "/treatment-plans/:planId/medications",
  validateMedicationPlanId,
  treatmentMedicationController.listForDoctor,
);

router.get(
  "/treatment-plans/:planId/medications/:medicationId",
  validateMedicationPlanId,
  validateMedicationId,
  treatmentMedicationController.getForDoctor,
);

router.patch(
  "/treatment-plans/:planId/medications/:medicationId",
  validateMedicationPlanId,
  validateMedicationId,
  validateUpdateTreatmentMedication,
  treatmentMedicationController.updateForDoctor,
);

router.delete(
  "/treatment-plans/:planId/medications/:medicationId",
  validateMedicationPlanId,
  validateMedicationId,
  treatmentMedicationController.deleteForDoctor,
);

router.post(
  "/treatment-plans/:planId/appointments",
  validateAppointmentPlanId,
  validateCreateTreatmentAppointment,
  treatmentAppointmentController.create,
);

router.get(
  "/treatment-plans/:planId/appointments",
  validateAppointmentPlanId,
  treatmentAppointmentController.listForDoctor,
);

router.get(
  "/treatment-plans/:planId/appointments/:appointmentId",
  validateAppointmentPlanId,
  validateAppointmentId,
  treatmentAppointmentController.getForDoctor,
);

router.patch(
  "/treatment-plans/:planId/appointments/:appointmentId",
  validateAppointmentPlanId,
  validateAppointmentId,
  validateUpdateTreatmentAppointment,
  treatmentAppointmentController.updateForDoctor,
);

router.delete(
  "/treatment-plans/:planId/appointments/:appointmentId",
  validateAppointmentPlanId,
  validateAppointmentId,
  treatmentAppointmentController.deleteForDoctor,
);

module.exports = router;
