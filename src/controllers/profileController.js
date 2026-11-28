const {
  getOwnProfile,
  updateOwnProfile,
} = require("../services/profileService");
const { changeOwnPassword } = require("../services/passwordChangeService");
const formatDateOnly = require("../utils/formatDateOnly");
const requestActor = require("../utils/requestActor");

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

async function changeOwnPasswordHandler(req, res) {
  await changeOwnPassword(req.user, req.validatedPasswordChange, requestActor(req));

  return res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
}

module.exports = {
  changeOwnPassword: changeOwnPasswordHandler,
  getOwnProfile: getOwnProfileHandler,
  updateOwnProfile: updateOwnProfileHandler,
};
