const express = require("express");

const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const profileController = require("../controllers/profileController");
const validateProfileUpdate = require("../middleware/validateProfileUpdate");

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

module.exports = router;
