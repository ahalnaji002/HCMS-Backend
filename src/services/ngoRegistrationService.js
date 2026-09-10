const bcrypt = require("bcryptjs");

const db = require("../config/database");
const joinRequestModel = require("../models/joinRequestModel");
const ngoModel = require("../models/ngoModel");
const userModel = require("../models/userModel");

const PASSWORD_SALT_ROUNDS = 12;

class NgoRegistrationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "NgoRegistrationConflictError";
  }
}

function isDuplicateKeyError(error) {
  return error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062);
}

async function findConflict(registration) {
  const existingUserPromise = userModel.findByEmail(registration.email);
  const existingNgoPromise =
    registration.registration_number === undefined ||
    registration.registration_number === null
      ? Promise.resolve(undefined)
      : ngoModel.findByRegistrationNumber(registration.registration_number);

  const [existingUser, existingNgo] = await Promise.all([
    existingUserPromise,
    existingNgoPromise,
  ]);

  if (existingUser) {
    return new NgoRegistrationConflictError(
      "An account with this email already exists"
    );
  }

  if (existingNgo) {
    return new NgoRegistrationConflictError(
      "An NGO with this registration number already exists"
    );
  }

  return null;
}

async function registerNgo(registration) {
  const existingConflict = await findConflict(registration);

  if (existingConflict) {
    throw existingConflict;
  }

  const passwordHash = await bcrypt.hash(
    registration.password,
    PASSWORD_SALT_ROUNDS
  );

  try {
    return await db.transaction(async (trx) => {
      const user = await userModel.create(
        {
          full_name: registration.full_name,
          email: registration.email,
          password_hash: passwordHash,
          role: "NGO",
          account_status: "INACTIVE",
        },
        trx
      );

      const ngo = await ngoModel.create(
        {
          user_id: user.id,
          organization_name: registration.organization_name,
          registration_number: registration.registration_number,
          address: registration.address,
          contact_phone: registration.phone,
        },
        trx
      );

      const joinRequest = await joinRequestModel.create(
        {
          user_id: user.id,
          request_type: "NGO",
        },
        trx
      );

      return {
        user,
        ngo,
        join_request: joinRequest,
      };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const conflict = await findConflict(registration);

      throw (
        conflict ||
        new NgoRegistrationConflictError(
          "NGO registration conflicts with an existing record"
        )
      );
    }

    throw error;
  }
}

module.exports = {
  NgoRegistrationConflictError,
  registerNgo,
};
