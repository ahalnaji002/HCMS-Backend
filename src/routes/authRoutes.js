const express = require("express");

const authController = require("../controllers/authController");
const validateDoctorRegistration = require("../middleware/validateDoctorRegistration");
const validateNgoRegistration = require("../middleware/validateNgoRegistration");
const validatePatientRegistration = require("../middleware/validatePatientRegistration");

const validateLogin = require("../middleware/validateLogin");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

// ==============================
// Patient Registration
// ==============================

router.post(
  "/register/patient",
  validatePatientRegistration,
  authController.registerPatient
);

// ==============================
// Doctor Registration
// ==============================

router.post(
  "/register/doctor",
  validateDoctorRegistration,
  authController.registerDoctor
);

// ==============================
// NGO Registration
// ==============================

router.post(
  "/register/ngo",
  validateNgoRegistration,
  authController.registerNgo
);

// ==============================
// Login
// ==============================

router.post("/login", validateLogin, authController.login);

// ==============================
// Current User
// ==============================

router.get("/me", authenticate, authController.currentUser);

module.exports = router;
