const assistanceRequestModel = require("../models/assistanceRequestModel");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const patientModel = require("../models/patientModel");

class AssistanceRequestNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistanceRequestNotFoundError";
  }
}

class AssistanceRequestForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistanceRequestForbiddenError";
  }
}

async function getPatientOrThrow(patientId) {
  const patient = await patientModel.findById(patientId);

  if (!patient) {
    throw new AssistanceRequestNotFoundError("Patient not found");
  }

  return patient;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new AssistanceRequestNotFoundError("Doctor profile not found");
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
    throw new AssistanceRequestForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }

  return assignment;
}

async function getPatientProfileOrThrow(userId) {
  const patient = await patientModel.findByUserId(userId);

  if (!patient) {
    throw new AssistanceRequestNotFoundError("Patient profile not found");
  }

  return patient;
}

async function createForAssignedPatient(user, patientId, requestData) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  return assistanceRequestModel.create({
    patient_id: patientId,
    doctor_id: doctor.id,
    request_type: requestData.request_type,
    description: requestData.description,
  });
}

async function listOwnRequests(user) {
  const patient = await getPatientProfileOrThrow(user.id);

  return assistanceRequestModel.listByPatientId(patient.id);
}

async function getOwnRequest(user, requestId) {
  const patient = await getPatientProfileOrThrow(user.id);
  const assistanceRequest = await assistanceRequestModel.findByIdAndPatientId(
    requestId,
    patient.id,
  );

  if (!assistanceRequest) {
    throw new AssistanceRequestNotFoundError("Assistance Request not found");
  }

  return assistanceRequest;
}

module.exports = {
  AssistanceRequestForbiddenError,
  AssistanceRequestNotFoundError,
  createForAssignedPatient,
  getOwnRequest,
  listOwnRequests,
};
