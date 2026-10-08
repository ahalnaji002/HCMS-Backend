const db = require("../config/database");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const patientIntakeModel = require("../models/patientIntakeModel");
const patientModel = require("../models/patientModel");

class PatientIntakeNotFoundError extends Error {
  constructor(message = "Patient intake not found") {
    super(message);
    this.name = "PatientIntakeNotFoundError";
  }
}

class PatientIntakeConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "PatientIntakeConflictError";
  }
}

class PatientProfileNotFoundError extends Error {
  constructor() {
    super("Patient profile not found");
    this.name = "PatientProfileNotFoundError";
  }
}

class DoctorProfileNotFoundError extends Error {
  constructor() {
    super("Doctor profile not found");
    this.name = "DoctorProfileNotFoundError";
  }
}

class PatientIntakeForbiddenError extends Error {
  constructor() {
    super("Active Doctor-Patient Assignment required");
    this.name = "PatientIntakeForbiddenError";
  }
}

async function getOwnPatient(userId, connection = db) {
  const patient = await patientModel.findByUserId(userId, connection);
  if (!patient) throw new PatientProfileNotFoundError();
  return patient;
}

async function getOwnIntake(user) {
  const patient = await getOwnPatient(user.id);
  return (await patientIntakeModel.findByPatientId(patient.id)) ?? null;
}

async function submitOwnIntake(user, intakeData) {
  return db.transaction(async (trx) => {
    const patient = await getOwnPatient(user.id, trx);
    await patientModel.findByIdForUpdate(patient.id, trx);

    const existing = await patientIntakeModel.findByPatientIdForUpdate(
      patient.id,
      trx,
    );
    if (existing) {
      throw new PatientIntakeConflictError(
        "A patient intake has already been submitted",
      );
    }

    try {
      return await patientIntakeModel.create(patient.id, intakeData, trx);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        throw new PatientIntakeConflictError(
          "A patient intake has already been submitted",
        );
      }
      throw error;
    }
  });
}

async function updateOwnIntake(user, intakeData) {
  return db.transaction(async (trx) => {
    const patient = await getOwnPatient(user.id, trx);
    const intake = await patientIntakeModel.findByPatientIdForUpdate(
      patient.id,
      trx,
    );
    if (!intake) throw new PatientIntakeNotFoundError();
    if (intake.status !== "SUBMITTED") {
      throw new PatientIntakeConflictError(
        "Patient intake is read-only after review starts",
      );
    }

    return patientIntakeModel.update(intake.id, intakeData, trx);
  });
}

function listForAdmin() {
  return patientIntakeModel.listForAdmin();
}

async function startReview(intakeId, adminUserId) {
  return db.transaction(async (trx) => {
    const intake = await patientIntakeModel.findByIdForUpdate(intakeId, trx);
    if (!intake) throw new PatientIntakeNotFoundError();
    if (intake.status !== "SUBMITTED") {
      throw new PatientIntakeConflictError(
        "Only a submitted intake can enter review",
      );
    }
    return patientIntakeModel.startReview(intake.id, adminUserId, trx);
  });
}

async function getForAssignedDoctor(user, patientId) {
  const doctor = await doctorModel.findByUserId(user.id);
  if (!doctor) throw new DoctorProfileNotFoundError();

  const assignment =
    await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
      doctor.id,
      patientId,
    );
  if (!assignment) throw new PatientIntakeForbiddenError();

  const intake = await patientIntakeModel.findByPatientId(patientId);
  if (!intake) throw new PatientIntakeNotFoundError();
  return intake;
}

module.exports = {
  DoctorProfileNotFoundError,
  PatientIntakeConflictError,
  PatientIntakeForbiddenError,
  PatientIntakeNotFoundError,
  PatientProfileNotFoundError,
  getForAssignedDoctor,
  getOwnIntake,
  listForAdmin,
  startReview,
  submitOwnIntake,
  updateOwnIntake,
};
