const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const medicalRecordController = require("../controllers/medicalRecordController");

const router = express.Router();

router.use(authenticate, authorizeRoles("PATIENT"));

router.get("/medical-record", medicalRecordController.getOwnMedicalRecord);

module.exports = router;
