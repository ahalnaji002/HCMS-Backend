const userManagementService = require("../services/userManagementService");

async function listUsers(req, res) {
  const result = await userManagementService.listUsers(req.validatedUserListQuery);

  return res.status(200).json({
    success: true,
    message: "Users retrieved successfully",
    data: result,
  });
}

async function updateUserStatus(req, res) {
  const user = await userManagementService.updateUserAccountStatus(
    req.user,
    req.params.userId,
    req.validatedAccountStatus,
    req.ip,
  );

  return res.status(200).json({
    success: true,
    message: "User account status updated successfully",
    data: { user },
  });
}

async function listNgos(req, res) {
  const ngos = await userManagementService.listNgos(req.validatedNgoListQuery);

  return res.status(200).json({
    success: true,
    message: "NGOs retrieved successfully",
    data: { ngos },
  });
}

module.exports = {
  listUsers,
  updateUserStatus,
  listNgos,
};
