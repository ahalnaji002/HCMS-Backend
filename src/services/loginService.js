const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
const joinRequestModel = require("../models/joinRequestModel");
const db = require("../config/database");
const activityLogService = require("./activityLogService");
const { signToken } = require("./tokenService");
const { ForbiddenError, UnauthorizedError } = require("../utils/apiErrors");

class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

class AccountNotActiveError extends ForbiddenError {
  constructor(application = null) {
    super(
      "Account is not active",
      application ? { application } : undefined,
    );
    this.name = "AccountNotActiveError";
    this.application = application;
  }
}

// bcrypt hash (cost 12, same as real accounts) of a random value nobody
// knows. Unknown emails are compared against it so they take as long as a
// wrong password and response time does not reveal which emails exist.
const DUMMY_PASSWORD_HASH =
  "$2b$12$lvPCBEtm2Ouza155b0/K..pw.uaymvpsMcmQBbUZg8u.AhpQtMVsC";

async function login(credentials, ipAddress = null) {
  const user = await userModel.findByEmailWithPasswordHash(credentials.email);
  const passwordMatches = await bcrypt.compare(
    credentials.password,
    user ? user.password_hash : DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    await activityLogService.recordEvent(
      {
        action: "LOGIN_FAILED",
        actorUserId: null,
        entityId: user ? user.id : null,
        ipAddress,
      },
      db,
    );
    throw new InvalidCredentialsError();
  }

  if (user.account_status !== "ACTIVE") {
    if (
      user.account_status === "INACTIVE" &&
      (user.role === "DOCTOR" || user.role === "NGO")
    ) {
      const application = await joinRequestModel.findLatestApplicantStatusByUserId(
        user.id,
      );

      if (application && ["PENDING", "REJECTED"].includes(application.status)) {
        throw new AccountNotActiveError({
          request_type: application.request_type,
          status: application.status,
          rejection_reason:
            application.status === "REJECTED"
              ? application.rejection_reason
              : null,
          submitted_at: application.created_at,
          reviewed_at: application.reviewed_at,
        });
      }
    }

    throw new AccountNotActiveError();
  }

  const token = signToken(user);

  await activityLogService.recordEvent(
    { action: "LOGIN_SUCCESS", actorUserId: user.id, entityId: user.id, ipAddress },
    db,
  );

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
