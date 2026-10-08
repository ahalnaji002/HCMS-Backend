const db = require("../config/database");
const intakeCorrectionRequestModel = require("../models/intakeCorrectionRequestModel");
const patientIntakeModel = require("../models/patientIntakeModel");
const patientModel = require("../models/patientModel");

class IntakeCorrectionRequestNotFoundError extends Error {
  constructor() {
    super("Intake correction request not found");
    this.name = "IntakeCorrectionRequestNotFoundError";
  }
}

class IntakeCorrectionRequestConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "IntakeCorrectionRequestConflictError";
  }
}

class IntakeCorrectionRequestForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "IntakeCorrectionRequestForbiddenError";
  }
}

class IntakeCorrectionPatientNotFoundError extends Error {
  constructor() {
    super("Patient profile not found");
    this.name = "IntakeCorrectionPatientNotFoundError";
  }
}

async function getPatient(userId, connection = db) {
  const patient = await patientModel.findByUserId(userId, connection);
  if (!patient) throw new IntakeCorrectionPatientNotFoundError();
  return patient;
}

async function listOwn(user) {
  const patient = await getPatient(user.id);
  return intakeCorrectionRequestModel.listByPatientId(patient.id);
}

async function createOwn(user, message) {
  const patient = await getPatient(user.id);
  const intake = await patientIntakeModel.findByPatientId(patient.id);
  if (!intake) {
    throw new IntakeCorrectionRequestConflictError(
      "Submit a patient intake before requesting a correction",
    );
  }
  if (intake.status === "SUBMITTED") {
    throw new IntakeCorrectionRequestConflictError(
      "Correction requests are available after administration starts review",
    );
  }

  return intakeCorrectionRequestModel.create(patient.id, message);
}

function listForAdmin() {
  return intakeCorrectionRequestModel.listForAdmin();
}

async function resolveForAdmin(requestId, adminUserId, adminResponse) {
  return db.transaction(async (trx) => {
    const request = await intakeCorrectionRequestModel.findByIdForUpdate(
      requestId,
      trx,
    );
    if (!request) throw new IntakeCorrectionRequestNotFoundError();
    if (request.status !== "OPEN") {
      throw new IntakeCorrectionRequestConflictError(
        "Intake correction request is already resolved",
      );
    }
    return intakeCorrectionRequestModel.resolve(
      requestId,
      adminUserId,
      adminResponse,
      trx,
    );
  });
}

module.exports = {
  IntakeCorrectionPatientNotFoundError,
  IntakeCorrectionRequestConflictError,
  IntakeCorrectionRequestForbiddenError,
  IntakeCorrectionRequestNotFoundError,
  createOwn,
  listForAdmin,
  listOwn,
  resolveForAdmin,
};
