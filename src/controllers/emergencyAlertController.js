const emergencyAlertService = require("../services/emergencyAlertService");

async function createPublicAlert(req, res) {
  const emergencyAlert = await emergencyAlertService.createPublicAlert(
    req.validatedEmergencyAlert,
  );

  return res.status(201).json({
    success: true,
    message: "Emergency Alert created successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

async function createPatientAlert(req, res) {
  const emergencyAlert = await emergencyAlertService.createPatientAlert(
    req.user,
    req.validatedEmergencyAlert,
  );

  return res.status(201).json({
    success: true,
    message: "Emergency Alert created successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

async function listOwnAlerts(req, res) {
  const emergencyAlerts = await emergencyAlertService.listOwnAlerts(req.user);

  return res.status(200).json({
    success: true,
    message: "Emergency Alerts retrieved successfully",
    data: {
      emergency_alerts: emergencyAlerts,
    },
  });
}

async function getOwnAlert(req, res) {
  const emergencyAlert = await emergencyAlertService.getOwnAlert(
    req.user,
    req.params.alertId,
  );

  return res.status(200).json({
    success: true,
    message: "Emergency Alert retrieved successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

async function cancelOwnAlert(req, res) {
  const emergencyAlert = await emergencyAlertService.cancelOwnAlert(
    req.user,
    req.params.alertId,
  );

  return res.status(200).json({
    success: true,
    message: "Emergency Alert cancelled successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

async function listForAdmin(req, res) {
  const emergencyAlerts = await emergencyAlertService.listAlertsForAdmin();

  return res.status(200).json({
    success: true,
    message: "Emergency Alerts retrieved successfully",
    data: {
      emergency_alerts: emergencyAlerts,
    },
  });
}

async function getForAdmin(req, res) {
  const emergencyAlert = await emergencyAlertService.getAlertForAdmin(
    req.params.alertId,
  );

  return res.status(200).json({
    success: true,
    message: "Emergency Alert retrieved successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

async function assignDoctor(req, res) {
  const emergencyAlert = await emergencyAlertService.assignDoctorToAlert(
    req.user,
    req.params.alertId,
    req.validatedEmergencyAlertAssignment.doctor_id,
    req.ip,
  );

  return res.status(200).json({
    success: true,
    message: "Emergency Alert assigned successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

async function updateStatusForDoctor(req, res) {
  const emergencyAlert =
    await emergencyAlertService.updateStatusForAssignedDoctor(
      req.user,
      req.params.alertId,
      req.validatedEmergencyAlertStatus.status,
      req.ip,
    );

  return res.status(200).json({
    success: true,
    message: "Emergency Alert status updated successfully",
    data: {
      emergency_alert: emergencyAlert,
    },
  });
}

module.exports = {
  createPublicAlert,
  createPatientAlert,
  listOwnAlerts,
  getOwnAlert,
  cancelOwnAlert,
  listForAdmin,
  getForAdmin,
  assignDoctor,
  updateStatusForDoctor,
};
