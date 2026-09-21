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

const router = express.Router();

router.use(authenticate, authorizeRoles("PATIENT"));

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

module.exports = router;
