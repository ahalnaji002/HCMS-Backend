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

module.exports = {
  ProfileNotFoundError,
  getOwnProfile,
};
