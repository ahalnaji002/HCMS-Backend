const doctorDiagnosisModel = require("../models/doctorDiagnosisModel");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const patientModel = require("../models/patientModel");

class DoctorDiagnosisNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctorDiagnosisNotFoundError";
  }
}

class DoctorDiagnosisForbiddenError extends Error {
  constructor() {
    super("Active Doctor-Patient Assignment required");
    this.name = "DoctorDiagnosisForbiddenError";
  }
}

async function getPatientOrThrow(patientId) {
  const patient = await patientModel.findById(patientId);
  if (!patient) throw new DoctorDiagnosisNotFoundError("Patient not found");
  return patient;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);
  if (!doctor) throw new DoctorDiagnosisNotFoundError("Doctor profile not found");
  return doctor;
}

async function requireAssignment(doctorId, patientId) {
  const assignment =
    await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
      doctorId,
      patientId,
    );
  if (!assignment) throw new DoctorDiagnosisForbiddenError();
}

async function listForPatient(user, patientId) {
  await getPatientOrThrow(patientId);
  const doctor = await getDoctorOrThrow(user.id);
  await requireAssignment(doctor.id, patientId);
  return doctorDiagnosisModel.listByPatientId(patientId);
}

async function createForPatient(user, patientId, diagnosis) {
  await getPatientOrThrow(patientId);
  const doctor = await getDoctorOrThrow(user.id);
  await requireAssignment(doctor.id, patientId);
  return doctorDiagnosisModel.create({
    patient_id: patientId,
    doctor_id: doctor.id,
    diagnosis,
  });
}

async function listOwn(user) {
  const patient = await patientModel.findByUserId(user.id);
  if (!patient) throw new DoctorDiagnosisNotFoundError("Patient profile not found");
  return doctorDiagnosisModel.listByPatientId(patient.id);
}

module.exports = {
  DoctorDiagnosisForbiddenError,
  DoctorDiagnosisNotFoundError,
  createForPatient,
  listForPatient,
  listOwn,
};
