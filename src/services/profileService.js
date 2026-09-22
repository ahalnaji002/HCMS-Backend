const db = require("../config/database");
const userModel = require("../models/userModel");
const patientModel = require("../models/patientModel");
const doctorModel = require("../models/doctorModel");
const ngoModel = require("../models/ngoModel");

class ProfileNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProfileNotFoundError";
  }
}

async function getOwnProfile(user) {
  const baseProfile = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    account_status: user.account_status,
    phone: user.phone,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };

  if (user.role === "PATIENT") {
    const patient = await patientModel.findByUserId(user.id);

    if (!patient) {
      throw new ProfileNotFoundError("Patient profile not found");
    }

    return {
      ...baseProfile,
      national_id: patient.national_id,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      address: patient.address,
    };
  }

  if (user.role === "DOCTOR") {
    const doctor = await doctorModel.findByUserId(user.id);

    if (!doctor) {
      throw new ProfileNotFoundError("Doctor profile not found");
    }

    return {
      ...baseProfile,
      specialization: doctor.specialization,
      license_number: doctor.license_number,
    };
  }

  if (user.role === "NGO") {
    const ngo = await ngoModel.findByUserId(user.id);

    if (!ngo) {
      throw new ProfileNotFoundError("NGO profile not found");
    }

    return {
      ...baseProfile,
      organization_name: ngo.organization_name,
      registration_number: ngo.registration_number,
      address: ngo.address,
      contact_phone: ngo.contact_phone,
    };
  }

  if (user.role === "ADMIN") {
    return baseProfile;
  }

  throw new ProfileNotFoundError("Profile not found");
}

async function updateOwnProfile(user, updates) {
  await db.transaction(async (trx) => {
    const userUpdates = {};
    const patientUpdates = {};

    if (user.role === "PATIENT") {
      const patient = await patientModel.findByUserId(user.id, trx);

      if (!patient) {
        throw new ProfileNotFoundError("Patient profile not found");
      }
    }

    if (user.role === "DOCTOR") {
      const doctor = await doctorModel.findByUserId(user.id, trx);

      if (!doctor) {
        throw new ProfileNotFoundError("Doctor profile not found");
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "full_name")) {
      userUpdates.full_name = updates.full_name;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "phone")) {
      userUpdates.phone = updates.phone;
    }

    if (user.role === "PATIENT") {
      if (Object.prototype.hasOwnProperty.call(updates, "date_of_birth")) {
        patientUpdates.date_of_birth = updates.date_of_birth;
      }

      if (Object.prototype.hasOwnProperty.call(updates, "gender")) {
        patientUpdates.gender = updates.gender;
      }

      if (Object.prototype.hasOwnProperty.call(updates, "address")) {
        patientUpdates.address = updates.address;
      }
    }

    if (
      Object.keys(userUpdates).length > 0 ||
      Object.keys(patientUpdates).length > 0
    ) {
      await userModel.updateProfile(user.id, userUpdates, trx);
    }

    if (Object.keys(patientUpdates).length > 0) {
      await patientModel.updateProfile(user.id, patientUpdates, trx);
    }
  });

  const updatedUser = await userModel.findById(user.id);

  if (!updatedUser) {
    throw new ProfileNotFoundError("Profile not found");
  }

  return getOwnProfile(updatedUser);
}

module.exports = {
  ProfileNotFoundError,
  getOwnProfile,
  updateOwnProfile,
};
