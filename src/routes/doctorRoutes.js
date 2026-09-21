const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const medicalRecordController = require("../controllers/medicalRecordController");
const medicalNoteController = require("../controllers/medicalNoteController");
const treatmentPlanController = require("../controllers/treatmentPlanController");
const treatmentMedicationController = require("../controllers/treatmentMedicationController");

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

const router = express.Router();

router.use(authenticate, authorizeRoles("DOCTOR"));

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

module.exports = router;
