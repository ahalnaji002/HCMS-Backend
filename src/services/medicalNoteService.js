const patientModel = require("../models/patientModel");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const medicalRecordModel = require("../models/medicalRecordModel");
const medicalNoteModel = require("../models/medicalNoteModel");

class MedicalNoteNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MedicalNoteNotFoundError";
  }
}

class MedicalNoteForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "MedicalNoteForbiddenError";
  }
}

async function getPatientOrThrow(patientId) {
  const patient = await patientModel.findById(patientId);

  if (!patient) {
    throw new MedicalNoteNotFoundError("Patient not found");
  }

  return patient;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new MedicalNoteNotFoundError("Doctor profile not found");
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
    throw new MedicalNoteForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }

  return assignment;
}

async function getMedicalRecordOrThrow(patientId) {
  const medicalRecord = await medicalRecordModel.findByPatientId(patientId);

  if (!medicalRecord) {
    throw new MedicalNoteNotFoundError("Medical Record not found");
  }

  return medicalRecord;
}

async function createForAssignedPatient(user, patientId, medicalNoteData) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  const medicalRecord = await getMedicalRecordOrThrow(patientId);

  return medicalNoteModel.create({
    medical_record_id: medicalRecord.id,
    doctor_id: doctor.id,
    note: medicalNoteData.note,
  });
}

async function listForAssignedPatient(user, patientId) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  const medicalRecord = await getMedicalRecordOrThrow(patientId);

  return medicalNoteModel.listByMedicalRecordAndDoctor(
    medicalRecord.id,
    doctor.id,
  );
}

module.exports = {
  MedicalNoteForbiddenError,
  MedicalNoteNotFoundError,
  createForAssignedPatient,
  listForAssignedPatient,
};
