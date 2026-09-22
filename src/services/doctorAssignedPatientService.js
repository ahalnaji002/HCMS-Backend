const doctorModel = require("../models/doctorModel");
const patientModel = require("../models/patientModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");

class DoctorAssignedPatientNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctorAssignedPatientNotFoundError";
  }
}

class DoctorAssignedPatientForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctorAssignedPatientForbiddenError";
  }
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new DoctorAssignedPatientNotFoundError("Doctor profile not found");
  }

  return doctor;
}

async function listAssignedPatients(user) {
  const doctor = await getDoctorOrThrow(user.id);

  return doctorPatientAssignmentModel.listActivePatientsByDoctorId(doctor.id);
}

async function getAssignedPatient(user, patientId) {
  const patient = await patientModel.findProfileById(patientId);

  if (!patient) {
    throw new DoctorAssignedPatientNotFoundError("Patient not found");
  }

  const doctor = await getDoctorOrThrow(user.id);
  const assignment =
    await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
      doctor.id,
      patientId,
    );

  if (!assignment) {
    throw new DoctorAssignedPatientForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }

  return patient;
}

module.exports = {
  DoctorAssignedPatientForbiddenError,
  DoctorAssignedPatientNotFoundError,
  getAssignedPatient,
  listAssignedPatients,
};
