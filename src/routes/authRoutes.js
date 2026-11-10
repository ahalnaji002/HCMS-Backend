const express = require("express");

const authController = require("../controllers/authController");
const validateDoctorRegistration = require("../middleware/validateDoctorRegistration");
const validateNgoRegistration = require("../middleware/validateNgoRegistration");
const validatePatientRegistration = require("../middleware/validatePatientRegistration");

const validateLogin = require("../middleware/validateLogin");

const authenticate = require("../middleware/authenticate");
const {
  loginLimiter,
  registrationLimiter,
} = require("../middleware/rateLimiters");

const router = express.Router();

// ==============================
// Patient Registration
// ==============================

router.post(
  "/register/patient",
  registrationLimiter,
  validatePatientRegistration,
  authController.registerPatient
);

// ==============================
// Doctor Registration
// ==============================

router.post(
  "/register/doctor",
  registrationLimiter,
  validateDoctorRegistration,
  authController.registerDoctor
);

// ==============================
// NGO Registration
// ==============================

router.post(
  "/register/ngo",
  registrationLimiter,
  validateNgoRegistration,
  authController.registerNgo
);

// ==============================
// Login
// ==============================

router.post("/login", loginLimiter, validateLogin, authController.login);

// ==============================
// Current User
// ==============================

router.get("/me", authenticate, authController.currentUser);

module.exports = router;
