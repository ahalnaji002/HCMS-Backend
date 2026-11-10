const express = require("express");

const emergencyAlertController = require("../controllers/emergencyAlertController");
const {
  validateCreateEmergencyAlert,
} = require("../middleware/validateEmergencyAlert");
const { publicEmergencyAlertLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post(
  "/",
  publicEmergencyAlertLimiter,
  validateCreateEmergencyAlert,
  emergencyAlertController.createPublicAlert,
);

module.exports = router;
