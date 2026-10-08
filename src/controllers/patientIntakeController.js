const patientIntakeService = require("../services/patientIntakeService");

function handleError(error, res) {
  if (error instanceof patientIntakeService.PatientIntakeNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error instanceof patientIntakeService.PatientProfileNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error instanceof patientIntakeService.PatientIntakeForbiddenError) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (error instanceof patientIntakeService.PatientIntakeConflictError) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error instanceof patientIntakeService.DoctorProfileNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }

  console.error("Patient intake error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function getOwn(req, res) {
  try {
    const intake = await patientIntakeService.getOwnIntake(req.user);
    return res.status(200).json({
      success: true,
      message: "Patient intake retrieved successfully",
      data: { intake },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createOwn(req, res) {
  try {
    const intake = await patientIntakeService.submitOwnIntake(
      req.user,
      req.validatedPatientIntake,
    );
    return res.status(201).json({
      success: true,
      message: "Patient intake submitted successfully",
      data: { intake },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function updateOwn(req, res) {
  try {
    const intake = await patientIntakeService.updateOwnIntake(
      req.user,
      req.validatedPatientIntake,
    );
    return res.status(200).json({
      success: true,
      message: "Patient intake updated successfully",
      data: { intake },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listForAdmin(req, res) {
  try {
    const intakes = await patientIntakeService.listForAdmin();
    return res.status(200).json({
      success: true,
      message: "Patient intakes retrieved successfully",
      data: { intakes },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function startReview(req, res) {
  try {
    const intake = await patientIntakeService.startReview(
      req.validatedIntakeId,
      req.user.id,
    );
    return res.status(200).json({
      success: true,
      message: "Patient intake review started successfully",
      data: { intake },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function getForAssignedDoctor(req, res) {
  try {
    const intake = await patientIntakeService.getForAssignedDoctor(
      req.user,
      req.validatedPatientId,
    );
    return res.status(200).json({
      success: true,
      message: "Assigned patient intake retrieved successfully",
      data: { intake },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  createOwn,
  getForAssignedDoctor,
  getOwn,
  listForAdmin,
  startReview,
  updateOwn,
};
