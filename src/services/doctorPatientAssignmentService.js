const db = require("../config/database");
const doctorModel = require("../models/doctorModel");
const patientModel = require("../models/patientModel");
const userModel = require("../models/userModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const patientIntakeModel = require("../models/patientIntakeModel");

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

class AssignmentStatusConflictError extends Error {
  constructor(status) {
    super(`Doctor-patient assignment is already ${status}`);
    this.name = "AssignmentStatusConflictError";
  }
}

class PatientIntakeRequiredError extends Error {
  constructor(message = "Patient intake must be under review before assignment") {
    super(message);
    this.name = "PatientIntakeRequiredError";
  }
}

class DoctorUnavailableError extends Error {
  constructor() {
    super("Unavailable doctors cannot receive routine assignments");
    this.name = "DoctorUnavailableError";
  }
}

class AssignmentReasonRequiredError extends Error {
  constructor() {
    super("A non-empty internal assignment reason is required");
    this.name = "AssignmentReasonRequiredError";
  }
}

async function requireAssignableIntake(patientId, connection) {
  const intake = await patientIntakeModel.findByPatientIdForUpdate(
    patientId,
    connection,
  );
  if (!intake || !["UNDER_REVIEW", "DOCTOR_ASSIGNED"].includes(intake.status)) {
    throw new PatientIntakeRequiredError();
  }
  return intake;
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

async function updateDoctorPatientAssignmentStatus(id, status) {
  const existingAssignment = await doctorPatientAssignmentModel.findById(id);

  if (!existingAssignment) {
    throw new AssignmentNotFoundError();
  }

  return db.transaction(async (trx) => {
    // Match the create workflow's doctor -> patient lock order so all
    // operations for the same pair serialize before checking ACTIVE state.
    await doctorModel.findByIdForUpdate(existingAssignment.doctor_id, trx);
    await patientModel.findByIdForUpdate(existingAssignment.patient_id, trx);

    const assignment =
      await doctorPatientAssignmentModel.findByIdForUpdate(id, trx);

    if (!assignment) {
      throw new AssignmentNotFoundError();
    }

    if (assignment.status === status) {
      throw new AssignmentStatusConflictError(status);
    }

    if (status === "ACTIVE") {
      if (
        typeof assignment.assignment_reason !== "string" ||
        assignment.assignment_reason.trim().length === 0
      ) {
        throw new AssignmentReasonRequiredError();
      }
      const doctor = await doctorModel.findByIdForUpdate(
        assignment.doctor_id,
        trx,
      );
      const doctorUser = doctor && await userModel.findById(doctor.user_id, trx);
      if (!doctorUser || doctorUser.role !== "DOCTOR" || doctorUser.account_status !== "ACTIVE") {
        throw new DoctorNotActiveError();
      }
      if (doctor.availability === "UNAVAILABLE") {
        throw new DoctorUnavailableError();
      }
      const patient = await patientModel.findByIdForUpdate(assignment.patient_id, trx);
      const patientUser = patient && await userModel.findById(patient.user_id, trx);
      if (!patientUser || patientUser.role !== "PATIENT" || patientUser.account_status !== "ACTIVE") {
        throw new PatientNotActiveError();
      }
      await requireAssignableIntake(assignment.patient_id, trx);

      const activeAssignment =
        await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
          assignment.doctor_id,
          assignment.patient_id,
          trx,
        );

      if (activeAssignment) {
        throw new ActiveAssignmentExistsError();
      }
    }

    const updated = await doctorPatientAssignmentModel.updateStatus(
      assignment.id,
      status,
      status === "INACTIVE" ? trx.fn.now() : null,
      trx,
    );
    if (status === "ACTIVE") {
      await patientIntakeModel.markDoctorAssigned(assignment.patient_id, trx);
    }
    return updated;
  });
}

async function createDoctorPatientAssignment(input) {
  if (
    typeof input.assignment_reason !== "string" ||
    input.assignment_reason.trim().length === 0
  ) {
    throw new AssignmentReasonRequiredError();
  }

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

    if (doctor.availability === "UNAVAILABLE") {
      throw new DoctorUnavailableError();
    }

    const patientUser = await userModel.findById(patient.user_id, trx);

    if (
      !patientUser ||
      patientUser.role !== "PATIENT" ||
      patientUser.account_status !== "ACTIVE"
    ) {
      throw new PatientNotActiveError();
    }

    const intake = await requireAssignableIntake(patient.id, trx);

    const activeAssignment =
      await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
        doctor.id,
        patient.id,
        trx,
      );

    if (activeAssignment) {
      throw new ActiveAssignmentExistsError();
    }

    const assignment = await doctorPatientAssignmentModel.create(
      {
        doctor_id: doctor.id,
        patient_id: patient.id,
        assignment_reason: input.assignment_reason,
        notes: input.notes,
      },
      trx,
    );
    if (intake.status !== "DOCTOR_ASSIGNED") {
      await patientIntakeModel.markDoctorAssigned(patient.id, trx);
    }
    return assignment;
  });
}

module.exports = {
  ActiveAssignmentExistsError,
  AssignmentNotFoundError,
  AssignmentStatusConflictError,
  AssignmentReasonRequiredError,
  DoctorUnavailableError,
  DoctorNotActiveError,
  DoctorNotFoundError,
  PatientNotActiveError,
  PatientNotFoundError,
  PatientIntakeRequiredError,
  createDoctorPatientAssignment,
  getDoctorPatientAssignment,
  listDoctorPatientAssignments,
  updateDoctorPatientAssignmentStatus,
};
