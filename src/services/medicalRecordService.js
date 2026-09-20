const patientModel = require("../models/patientModel");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const medicalRecordModel = require("../models/medicalRecordModel");

class MedicalRecordNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MedicalRecordNotFoundError";
  }
}

class MedicalRecordForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "MedicalRecordForbiddenError";
  }
}

class MedicalRecordConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "MedicalRecordConflictError";
  }
}

async function getPatientOrThrow(patientId) {
  const patient = await patientModel.findById(patientId);

  if (!patient) {
    throw new MedicalRecordNotFoundError("Patient not found");
  }

  return patient;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new MedicalRecordNotFoundError("Doctor profile not found");
  }

  return doctor;
}

async function requireActiveAssignment(doctorId, patientId) {
  const assignment =
    await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
      doctorId,
      patientId,
    );

  if (!assignment) {
    throw new MedicalRecordForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }

  return assignment;
}

async function createForAssignedPatient(user, patientId, medicalRecordData) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  const existingRecord = await medicalRecordModel.findByPatientId(patientId);

  if (existingRecord) {
    throw new MedicalRecordConflictError(
      "Medical Record already exists for this Patient",
    );
  }

  try {
    return await medicalRecordModel.create({
      patient_id: patientId,
      ...medicalRecordData,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new MedicalRecordConflictError(
        "Medical Record already exists for this Patient",
      );
    }

    throw error;
  }
}

async function getForAssignedPatient(user, patientId) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  const medicalRecord = await medicalRecordModel.findByPatientId(patientId);

  if (!medicalRecord) {
    throw new MedicalRecordNotFoundError("Medical Record not found");
  }

  return medicalRecord;
}

async function updateForAssignedPatient(user, patientId, medicalRecordUpdates) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  const existingRecord = await medicalRecordModel.findByPatientId(patientId);

  if (!existingRecord) {
    throw new MedicalRecordNotFoundError("Medical Record not found");
  }

  return medicalRecordModel.updateByPatientId(patientId, medicalRecordUpdates);
}

async function getOwnMedicalRecord(user) {
  const patient = await patientModel.findByUserId(user.id);

  if (!patient) {
    throw new MedicalRecordNotFoundError("Patient profile not found");
  }

  const medicalRecord = await medicalRecordModel.findByPatientId(patient.id);

  if (!medicalRecord) {
    throw new MedicalRecordNotFoundError("Medical Record not found");
  }

  return medicalRecord;
}

module.exports = {
  MedicalRecordConflictError,
  MedicalRecordForbiddenError,
  MedicalRecordNotFoundError,
  createForAssignedPatient,
  getForAssignedPatient,
  getOwnMedicalRecord,
  updateForAssignedPatient,
};
