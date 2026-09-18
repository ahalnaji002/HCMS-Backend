const {
  ProfileNotFoundError,
  getOwnProfile,
} = require("../services/profileService");
const formatDateOnly = require("../utils/formatDateOnly");

async function getOwnProfileHandler(req, res) {
  try {
    const profile = await getOwnProfile(req.user);

    if (req.user.role === "PATIENT") {
      profile.date_of_birth = formatDateOnly(profile.date_of_birth);
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: { profile },
    });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Profile retrieval failed");

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getOwnProfile: getOwnProfileHandler,
};
