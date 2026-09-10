const jwt = require("jsonwebtoken");

const ALGORITHM = "HS256";

class TokenConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TokenConfigurationError";
  }
}

class InvalidTokenError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "InvalidTokenError";
  }
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new TokenConfigurationError("JWT_SECRET is required");
  }
  return secret;
}

function signToken(user) {
  const secret = getSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (typeof expiresIn !== "string" || expiresIn.trim() === "") {
    throw new TokenConfigurationError("JWT_EXPIRES_IN is required");
  }

  return jwt.sign(
    { user_id: user.id, role: user.role },
    secret,
    { algorithm: ALGORITHM, expiresIn }
  );
}

function verifyToken(token) {
  const secret = getSecret();
  let payload;
  try {
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError();
    }
    throw error;
  }

  const validId =
    payload &&
    (typeof payload.user_id === "number"
      ? Number.isSafeInteger(payload.user_id) && payload.user_id > 0
      : typeof payload.user_id === "string" &&
        /^[1-9][0-9]*$/.test(payload.user_id));

  if (
    !validId ||
    typeof payload.role !== "string" ||
    payload.role.length === 0 ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    throw new InvalidTokenError();
  }

  return payload;
}

module.exports = {
  InvalidTokenError,
  TokenConfigurationError,
  signToken,
  verifyToken,
};
