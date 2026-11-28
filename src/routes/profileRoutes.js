const express = require("express");

const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const profileController = require("../controllers/profileController");
const validateProfileUpdate = require("../middleware/validateProfileUpdate");
const validatePasswordChange = require("../middleware/validatePasswordChange");
const { passwordChangeLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("PATIENT", "DOCTOR", "NGO", "ADMIN"),
  profileController.getOwnProfile,
);

router.patch(
  "/",
  authenticate,
  authorizeRoles("PATIENT", "DOCTOR"),
  validateProfileUpdate,
  profileController.updateOwnProfile,
);

router.patch(
  "/password",
  authenticate,
  authorizeRoles("PATIENT", "DOCTOR", "NGO", "ADMIN"),
  passwordChangeLimiter,
  validatePasswordChange,
  profileController.changeOwnPassword,
);

module.exports = router;
