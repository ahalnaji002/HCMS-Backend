const bcrypt = require("bcryptjs");

const db = require("../config/database");
const patientModel = require("../models/patientModel");
const userModel = require("../models/userModel");

const PASSWORD_SALT_ROUNDS = 12;

class DuplicateEmailError extends Error {
  constructor() {
    super("An account with this email already exists");
    this.name = "DuplicateEmailError";
  }
}

class DuplicateNationalIdError extends Error {
  constructor() {
    super("A patient with this national ID already exists");
    this.name = "DuplicateNationalIdError";
  }
}

function isDuplicateKeyError(error) {
  return error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062);
}

async function registerPatient(registration) {
  const [existingUser, existingPatient] = await Promise.all([
    userModel.findByEmail(registration.email),
    patientModel.findByNationalId(registration.national_id),
  ]);

  if (existingUser) {
    throw new DuplicateEmailError();
  }

  if (existingPatient) {
    throw new DuplicateNationalIdError();
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
          role: "PATIENT",
          account_status: "ACTIVE",
          phone: registration.phone,
        },
        trx
      );

      const patient = await patientModel.create(
        {
          user_id: user.id,
          national_id: registration.national_id,
          date_of_birth: registration.date_of_birth,
          gender: registration.gender,
          address: registration.address,
        },
        trx
      );

      return { user, patient };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const [conflictingUser, conflictingPatient] = await Promise.all([
        userModel.findByEmail(registration.email),
        patientModel.findByNationalId(registration.national_id),
      ]);

      if (conflictingUser) {
        throw new DuplicateEmailError();
      }

      if (conflictingPatient) {
        throw new DuplicateNationalIdError();
      }
    }

    throw error;
  }
}

module.exports = {
  DuplicateEmailError,
  DuplicateNationalIdError,
  registerPatient,
};
