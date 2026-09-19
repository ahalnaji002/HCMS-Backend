const db = require("../config/database");
const doctorModel = require("../models/doctorModel");
const patientModel = require("../models/patientModel");
const userModel = require("../models/userModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");

class DoctorNotFoundError extends Error {
  constructor() {
    super("Doctor not found");
    this.name = "DoctorNotFoundError";
  }
}

class PatientNotFoundError extends Error {
  constructor() {
    super("Patient not found");
    this.name = "PatientNotFoundError";
  }
}

class DoctorNotActiveError extends Error {
  constructor() {
    super("Doctor account is not active");
    this.name = "DoctorNotActiveError";
  }
}

class PatientNotActiveError extends Error {
  constructor() {
    super("Patient account is not active");
    this.name = "PatientNotActiveError";
  }
}

class ActiveAssignmentExistsError extends Error {
  constructor() {
    super("An active assignment already exists for this doctor and patient");
    this.name = "ActiveAssignmentExistsError";
  }
}

class AssignmentNotFoundError extends Error {
  constructor() {
    super("Doctor-patient assignment not found");
    this.name = "AssignmentNotFoundError";
  }
}

function listDoctorPatientAssignments() {
  return doctorPatientAssignmentModel.listAll();
}

async function getDoctorPatientAssignment(id) {
  const assignment = await doctorPatientAssignmentModel.findById(id);

  if (!assignment) {
    throw new AssignmentNotFoundError();
  }

  return assignment;
}

async function createDoctorPatientAssignment(input) {
  return db.transaction(async (trx) => {
    /*
     * Lock the doctor and patient rows before checking for an existing
     * ACTIVE assignment.
     *
     * Requests for the same doctor-patient pair will therefore serialize:
     * the second request waits for the first transaction to finish before
     * performing the duplicate check.
     */
    const doctor = await doctorModel.findByIdForUpdate(input.doctor_id, trx);

    if (!doctor) {
      throw new DoctorNotFoundError();
    }

    const patient = await patientModel.findByIdForUpdate(input.patient_id, trx);

    if (!patient) {
      throw new PatientNotFoundError();
    }

    const doctorUser = await userModel.findById(doctor.user_id, trx);

    if (
      !doctorUser ||
      doctorUser.role !== "DOCTOR" ||
      doctorUser.account_status !== "ACTIVE"
    ) {
      throw new DoctorNotActiveError();
    }

    const patientUser = await userModel.findById(patient.user_id, trx);

    if (
      !patientUser ||
      patientUser.role !== "PATIENT" ||
      patientUser.account_status !== "ACTIVE"
    ) {
      throw new PatientNotActiveError();
    }

    const activeAssignment =
      await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
        doctor.id,
        patient.id,
        trx,
      );

    if (activeAssignment) {
      throw new ActiveAssignmentExistsError();
    }

    return doctorPatientAssignmentModel.create(
      {
        doctor_id: doctor.id,
        patient_id: patient.id,
        assignment_reason: input.assignment_reason,
        notes: input.notes,
      },
      trx,
    );
  });
}

module.exports = {
  ActiveAssignmentExistsError,
  AssignmentNotFoundError,
  DoctorNotActiveError,
  DoctorNotFoundError,
  PatientNotActiveError,
  PatientNotFoundError,
  createDoctorPatientAssignment,
  getDoctorPatientAssignment,
  listDoctorPatientAssignments,
};
