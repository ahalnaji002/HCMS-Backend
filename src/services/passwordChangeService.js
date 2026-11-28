const bcrypt = require("bcryptjs");
const db = require("../config/database");
const userModel = require("../models/userModel");
const { recordActorEvent } = require("./activityLogService");
const { BadRequestError, NotFoundError } = require("../utils/apiErrors");

const PASSWORD_SALT_ROUNDS = 12;

class CurrentPasswordIncorrectError extends BadRequestError {
  constructor() {
    super("Validation failed");
    this.name = "CurrentPasswordIncorrectError";
    // Field-level shape used by the validator middleware, so the form can
    // show the message under the current password field. 400 rather than
    // 401 so the client does not treat it as an expired session.
    this.errors = { current_password: "current_password is incorrect" };
  }
}

/**
 * Changes the signed-in user's password after checking the current one.
 * The row is locked so two changes for the same account run one after the
 * other. Sessions already signed in stay valid until their token expires.
 */
async function changeOwnPassword(user, { currentPassword, newPassword }, actor) {
  return db.transaction(async (trx) => {
    const account = await userModel.findByIdWithPasswordHashForUpdate(user.id, trx);

    if (!account) {
      throw new NotFoundError("User not found");
    }

    if (!(await bcrypt.compare(currentPassword, account.password_hash))) {
      throw new CurrentPasswordIncorrectError();
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await userModel.updatePasswordHash(account.id, passwordHash, trx);
    await recordActorEvent(actor, "CHANGE_PASSWORD", account.id, trx);
  });
}

module.exports = {
  CurrentPasswordIncorrectError,
  changeOwnPassword,
};
