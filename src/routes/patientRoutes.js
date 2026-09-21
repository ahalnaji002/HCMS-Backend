const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const medicalRecordController = require("../controllers/medicalRecordController");

const treatmentPlanController = require("../controllers/treatmentPlanController");
const { validatePlanId } = require("../middleware/validateTreatmentPlan");

const router = express.Router();

router.use(authenticate, authorizeRoles("PATIENT"));

router.get("/medical-record", medicalRecordController.getOwnMedicalRecord);

router.get("/treatment-plans", treatmentPlanController.listOwnTreatmentPlans);

router.get(
  "/treatment-plans/:planId",
  validatePlanId,
  treatmentPlanController.getOwnTreatmentPlan,
);

module.exports = router;
