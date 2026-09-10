const APPROVED_ROLES = new Set(["PATIENT", "DOCTOR", "NGO", "ADMIN"]);

function authorizeRoles(...roles) {
  if (roles.length === 0) {
    throw new TypeError("authorizeRoles requires at least one approved role");
  }

  const invalidRole = roles.find(
    (role) => typeof role !== "string" || !APPROVED_ROLES.has(role)
  );

  if (invalidRole !== undefined) {
    throw new TypeError(
      `authorizeRoles received an invalid role: ${String(invalidRole)}`
    );
  }

  const allowedRoles = new Set(roles);

  return function authorizeRole(req, res, next) {
    if (!req.user || !allowedRoles.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return next();
  };
}

module.exports = authorizeRoles;
