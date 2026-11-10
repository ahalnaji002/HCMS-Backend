const patientIntakeService = require("../services/patientIntakeService");

async function getOwn(req, res) {
  const intake = await patientIntakeService.getOwnIntake(req.user);
  return res.status(200).json({
    success: true,
    message: "Patient intake retrieved successfully",
    data: { intake },
  });
}

async function createOwn(req, res) {
  const intake = await patientIntakeService.submitOwnIntake(
    req.user,
    req.validatedPatientIntake,
  );
  return res.status(201).json({
    success: true,
    message: "Patient intake submitted successfully",
    data: { intake },
  });
}

async function updateOwn(req, res) {
  const intake = await patientIntakeService.updateOwnIntake(
    req.user,
    req.validatedPatientIntake,
  );
  return res.status(200).json({
    success: true,
    message: "Patient intake updated successfully",
    data: { intake },
  });
}

async function listForAdmin(req, res) {
  const intakes = await patientIntakeService.listForAdmin();
  return res.status(200).json({
    success: true,
    message: "Patient intakes retrieved successfully",
    data: { intakes },
  });
}

async function startReview(req, res) {
  const intake = await patientIntakeService.startReview(
    req.validatedIntakeId,
    req.user.id,
  );
  return res.status(200).json({
    success: true,
    message: "Patient intake review started successfully",
    data: { intake },
  });
}

async function getForAssignedDoctor(req, res) {
  const intake = await patientIntakeService.getForAssignedDoctor(
    req.user,
    req.validatedPatientId,
  );
  return res.status(200).json({
    success: true,
    message: "Assigned patient intake retrieved successfully",
    data: { intake },
  });
}

module.exports = {
  createOwn,
  getForAssignedDoctor,
  getOwn,
  listForAdmin,
  startReview,
  updateOwn,
};
