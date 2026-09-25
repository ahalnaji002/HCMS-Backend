const patientModel = require("../models/patientModel");
const emergencyAlertModel = require("../models/emergencyAlertModel");

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

module.exports = {
  EmergencyAlertNotFoundError,
  EmergencyAlertValidationError,
  createPublicAlert,
  createPatientAlert,
  listOwnAlerts,
  getOwnAlert,
  cancelOwnAlert,
};
