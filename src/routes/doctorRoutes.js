const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const medicalRecordController = require("../controllers/medicalRecordController");
const medicalNoteController = require("../controllers/medicalNoteController");
const {
  validateCreateMedicalRecord,
  validatePatientId,
  validateUpdateMedicalRecord,
} = require("../middleware/validateMedicalRecord");

const {
  validateCreateMedicalNote,
} = require("../middleware/validateMedicalNote");

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

module.exports = router;
