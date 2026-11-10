const {
  getOwnProfile,
  updateOwnProfile,
} = require("../services/profileService");
const formatDateOnly = require("../utils/formatDateOnly");

async function getOwnProfileHandler(req, res) {
  const profile = await getOwnProfile(req.user);

  if (req.user.role === "PATIENT") {
    profile.date_of_birth = formatDateOnly(profile.date_of_birth);
  }

  return res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: { profile },
  });
}

async function updateOwnProfileHandler(req, res) {
  const profile = await updateOwnProfile(
    req.user,
    req.validatedProfileUpdate,
  );

  if (req.user.role === "PATIENT") {
    profile.date_of_birth = formatDateOnly(profile.date_of_birth);
  }

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: { profile },
  });
}

module.exports = {
  getOwnProfile: getOwnProfileHandler,
  updateOwnProfile: updateOwnProfileHandler,
};
