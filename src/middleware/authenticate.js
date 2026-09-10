const userModel = require("../models/userModel");
const { InvalidTokenError, verifyToken } = require("../services/tokenService");

function authenticationRequired(res) {
  return res.status(401).json({
    success: false,
    message: "Authentication required",
  });
}

async function authenticate(req, res, next) {
  const authorization = req.get("Authorization");
  const match =
    typeof authorization === "string" &&
    /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!match) {
    return authenticationRequired(res);
  }

  try {
    const payload = verifyToken(match[1]);
    const user = await userModel.findById(payload.user_id);

    if (!user) {
      return authenticationRequired(res);
    }

    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active",
      });
    }

    // Use the current database role and safe fields, not stale token claims.
    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return authenticationRequired(res);
    }
    return next(error);
  }
}

module.exports = authenticate;
