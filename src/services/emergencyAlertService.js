const patientModel = require("../models/patientModel");
const emergencyAlertModel = require("../models/emergencyAlertModel");
const db = require("../config/database");
const doctorModel = require("../models/doctorModel");
const userModel = require("../models/userModel");

class EmergencyAlertNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmergencyAlertNotFoundError";
  }
}

class EmergencyAlertValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmergencyAlertValidationError";
  }
}

class EmergencyAlertConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmergencyAlertConflictError";
  }
}

class EmergencyAlertDoctorNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmergencyAlertDoctorNotFoundError";
  }
}

class EmergencyAlertDoctorNotEligibleError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmergencyAlertDoctorNotEligibleError";
  }
}

async function getPatientProfileOrThrow(userId) {
  const patient = await patientModel.findByUserId(userId);

  if (!patient) {
    throw new EmergencyAlertNotFoundError("Patient profile not found");
  }

  return patient;
}

async function createPublicAlert(alertData) {
  return emergencyAlertModel.create({
    patient_id: null,
    phone: alertData.phone,
    location: alertData.location ?? null,
    description: alertData.description ?? null,
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
}

async function createPatientAlert(user, alertData) {
  const patient = await getPatientProfileOrThrow(user.id);

  return emergencyAlertModel.create({
    patient_id: patient.id,
    phone: alertData.phone,
    location: alertData.location ?? null,
    description: alertData.description ?? null,
    priority: "HIGH",
    status: "PENDING_ASSIGNMENT",
  });
}

async function listOwnAlerts(user) {
  const patient = await getPatientProfileOrThrow(user.id);

  return emergencyAlertModel.listByPatientId(patient.id);
}

async function getOwnAlert(user, alertId) {
  const patient = await getPatientProfileOrThrow(user.id);

  const alert = await emergencyAlertModel.findByIdAndPatientId(
    alertId,
    patient.id,
  );

  if (!alert) {
    throw new EmergencyAlertNotFoundError("Emergency Alert not found");
  }

  return alert;
}

async function cancelOwnAlert(user, alertId) {
  const patient = await getPatientProfileOrThrow(user.id);

  const existingAlert = await emergencyAlertModel.findByIdAndPatientId(
    alertId,
    patient.id,
  );

  if (!existingAlert) {
    throw new EmergencyAlertNotFoundError("Emergency Alert not found");
  }

  if (existingAlert.status !== "PENDING_ASSIGNMENT") {
    throw new EmergencyAlertValidationError(
      "Only Emergency Alerts pending assignment can be cancelled",
    );
  }

  const cancelledAlert =
    await emergencyAlertModel.cancelPendingByIdAndPatientId(
      alertId,
      patient.id,
    );

  if (!cancelledAlert) {
    throw new EmergencyAlertValidationError(
      "Emergency Alert can no longer be cancelled",
    );
  }

  return cancelledAlert;
}

function listAlertsForAdmin() {
  return emergencyAlertModel.listAll();
}

async function getAlertForAdmin(alertId) {
  const alert = await emergencyAlertModel.findById(alertId);

  if (!alert) {
    throw new EmergencyAlertNotFoundError("Emergency Alert not found");
  }

  return alert;
}

async function assignDoctorToAlert(user, alertId, doctorId) {
  return db.transaction(async (trx) => {
    const alert = await emergencyAlertModel.findByIdForUpdate(alertId, trx);

    if (!alert) {
      throw new EmergencyAlertNotFoundError("Emergency Alert not found");
    }

    if (alert.status !== "PENDING_ASSIGNMENT") {
      throw new EmergencyAlertConflictError(
        "Emergency Alert is not pending assignment",
      );
    }

    const doctor = await doctorModel.findByIdForUpdate(doctorId, trx);

    if (!doctor) {
      throw new EmergencyAlertDoctorNotFoundError("Doctor not found");
    }

    const doctorUser = await userModel.findByIdForUpdate(doctor.user_id, trx);

    if (
      !doctorUser ||
      doctorUser.role !== "DOCTOR" ||
      doctorUser.account_status !== "ACTIVE"
    ) {
      throw new EmergencyAlertDoctorNotEligibleError(
        "Doctor account is not active",
      );
    }

    const eligibleSpecializations = new Set([
      "General Medicine",
      "Emergency Medicine",
    ]);

    if (!eligibleSpecializations.has(doctor.specialization)) {
      throw new EmergencyAlertDoctorNotEligibleError(
        "Doctor specialization is not eligible for Emergency Alert assignment",
      );
    }

    const assignedAlert = await emergencyAlertModel.assignPendingToDoctor(
      alert.id,
      doctor.id,
      user.id,
      trx,
    );

    if (!assignedAlert) {
      throw new EmergencyAlertConflictError(
        "Emergency Alert can no longer be assigned",
      );
    }

    return assignedAlert;
  });
}

module.exports = {
  EmergencyAlertNotFoundError,
  EmergencyAlertValidationError,
  EmergencyAlertConflictError,
  EmergencyAlertDoctorNotFoundError,
  EmergencyAlertDoctorNotEligibleError,
  createPublicAlert,
  createPatientAlert,
  listOwnAlerts,
  getOwnAlert,
  cancelOwnAlert,
  listAlertsForAdmin,
  getAlertForAdmin,
  assignDoctorToAlert,
};
