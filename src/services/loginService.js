const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const { signToken } = require("./tokenService");

class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

class AccountNotActiveError extends Error {
  constructor() {
    super("Account is not active");
    this.name = "AccountNotActiveError";
  }
}

async function login(credentials) {
  const user = await userModel.findByEmailWithPasswordHash(credentials.email);

  if (!user || !(await bcrypt.compare(credentials.password, user.password_hash))) {
    throw new InvalidCredentialsError();
  }

  if (user.account_status !== "ACTIVE") {
    throw new AccountNotActiveError();
  }

  const token = signToken(user);

  return {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      account_status: user.account_status,
      phone: user.phone,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  };
}

module.exports = {
  InvalidCredentialsError,
  AccountNotActiveError,
  login,
};
