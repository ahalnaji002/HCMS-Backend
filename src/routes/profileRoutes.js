const express = require("express");

const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");
const profileController = require("../controllers/profileController");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("PATIENT", "DOCTOR", "NGO", "ADMIN"),
  profileController.getOwnProfile,
);

module.exports = router;
