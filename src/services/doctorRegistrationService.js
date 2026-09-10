const bcrypt = require("bcryptjs");

const db = require("../config/database");
const doctorModel = require("../models/doctorModel");
const joinRequestModel = require("../models/joinRequestModel");
const userModel = require("../models/userModel");

const PASSWORD_SALT_ROUNDS = 12;

class DoctorRegistrationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctorRegistrationConflictError";
  }
}

function isDuplicateKeyError(error) {
  return error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062);
}

async function findConflict(registration) {
  const [existingUser, existingDoctor] = await Promise.all([
    userModel.findByEmail(registration.email),
    doctorModel.findByLicenseNumber(registration.license_number),
  ]);

  if (existingUser) {
    return new DoctorRegistrationConflictError(
      "An account with this email already exists"
    );
  }

  if (existingDoctor) {
    return new DoctorRegistrationConflictError(
      "A doctor with this license number already exists"
    );
  }

  return null;
}

async function registerDoctor(registration) {
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
          role: "DOCTOR",
          account_status: "INACTIVE",
          phone: registration.phone,
        },
        trx
      );

      const doctor = await doctorModel.create(
        {
          user_id: user.id,
          specialization: registration.specialization,
          license_number: registration.license_number,
        },
        trx
      );

      const joinRequest = await joinRequestModel.create(
        {
          user_id: user.id,
          request_type: "DOCTOR",
        },
        trx
      );

      return {
        user,
        doctor,
        join_request: joinRequest,
      };
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const conflict = await findConflict(registration);

      throw (
        conflict ||
        new DoctorRegistrationConflictError(
          "Doctor registration conflicts with an existing record"
        )
      );
    }

    throw error;
  }
}

module.exports = {
  DoctorRegistrationConflictError,
  registerDoctor,
};
