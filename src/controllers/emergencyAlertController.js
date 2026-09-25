const emergencyAlertService = require("../services/emergencyAlertService");

function handleEmergencyAlertError(error, res) {
  if (error instanceof emergencyAlertService.EmergencyAlertValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof emergencyAlertService.EmergencyAlertNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Emergency Alert error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createPublicAlert(req, res) {
  try {
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
  } catch (error) {
    return handleEmergencyAlertError(error, res);
  }
}

async function createPatientAlert(req, res) {
  try {
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
  } catch (error) {
    return handleEmergencyAlertError(error, res);
  }
}

async function listOwnAlerts(req, res) {
  try {
    const emergencyAlerts = await emergencyAlertService.listOwnAlerts(req.user);

    return res.status(200).json({
      success: true,
      message: "Emergency Alerts retrieved successfully",
      data: {
        emergency_alerts: emergencyAlerts,
      },
    });
  } catch (error) {
    return handleEmergencyAlertError(error, res);
  }
}

async function getOwnAlert(req, res) {
  try {
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
  } catch (error) {
    return handleEmergencyAlertError(error, res);
  }
}

async function cancelOwnAlert(req, res) {
  try {
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
  } catch (error) {
    return handleEmergencyAlertError(error, res);
  }
}

module.exports = {
  createPublicAlert,
  createPatientAlert,
  listOwnAlerts,
  getOwnAlert,
  cancelOwnAlert,
};
