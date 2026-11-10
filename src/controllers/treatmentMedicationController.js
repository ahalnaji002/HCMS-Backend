const treatmentMedicationService = require("../services/treatmentMedicationService");

async function create(req, res) {
  const medication = await treatmentMedicationService.createForPlan(
    req.user,
    req.params.planId,
    req.validatedTreatmentMedication,
  );

  return res.status(201).json({
    success: true,
    message: "Treatment Medication created successfully",
    data: { medication },
  });
}

async function listForDoctor(req, res) {
  const medications = await treatmentMedicationService.listForDoctor(
    req.user,
    req.params.planId,
  );

  return res.status(200).json({
    success: true,
    message: "Treatment Medications retrieved successfully",
    data: { medications },
  });
}

async function getForDoctor(req, res) {
  const medication = await treatmentMedicationService.getForDoctor(
    req.user,
    req.params.planId,
    req.params.medicationId,
  );

  return res.status(200).json({
    success: true,
    message: "Treatment Medication retrieved successfully",
    data: { medication },
  });
}

async function updateForDoctor(req, res) {
  const medication = await treatmentMedicationService.updateForDoctor(
    req.user,
    req.params.planId,
    req.params.medicationId,
    req.validatedTreatmentMedication,
  );

  return res.status(200).json({
    success: true,
    message: "Treatment Medication updated successfully",
    data: { medication },
  });
}

async function deleteForDoctor(req, res) {
  const medication = await treatmentMedicationService.deleteForDoctor(
    req.user,
    req.params.planId,
    req.params.medicationId,
  );

  return res.status(200).json({
    success: true,
    message: "Treatment Medication deleted successfully",
    data: { medication },
  });
}

async function listForPatient(req, res) {
  const medications = await treatmentMedicationService.listForPatient(
    req.user,
    req.params.planId,
  );

  return res.status(200).json({
    success: true,
    message: "Treatment Medications retrieved successfully",
    data: { medications },
  });
}

async function getForPatient(req, res) {
  const medication = await treatmentMedicationService.getForPatient(
    req.user,
    req.params.planId,
    req.params.medicationId,
  );

  return res.status(200).json({
    success: true,
    message: "Treatment Medication retrieved successfully",
    data: { medication },
  });
}

module.exports = {
  create,
  deleteForDoctor,
  getForDoctor,
  getForPatient,
  listForDoctor,
  listForPatient,
  updateForDoctor,
};
