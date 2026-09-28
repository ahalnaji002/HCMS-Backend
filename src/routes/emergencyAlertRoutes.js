const express = require("express");

const emergencyAlertController = require("../controllers/emergencyAlertController");
const {
  validateCreateEmergencyAlert,
} = require("../middleware/validateEmergencyAlert");

const router = express.Router();

router.post(
  "/",
  validateCreateEmergencyAlert,
  emergencyAlertController.createPublicAlert,
);

module.exports = router;
