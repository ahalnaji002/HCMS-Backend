const treatmentMedicationService = require("../services/treatmentMedicationService");

function handleTreatmentMedicationError(error, res) {
  if (
    error instanceof treatmentMedicationService.TreatmentMedicationForbiddenError
  ) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error instanceof treatmentMedicationService.TreatmentMedicationNotFoundError
  ) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Treatment Medication error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function create(req, res) {
  try {
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
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
}

async function listForDoctor(req, res) {
  try {
    const medications = await treatmentMedicationService.listForDoctor(
      req.user,
      req.params.planId,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Medications retrieved successfully",
      data: { medications },
    });
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
}

async function getForDoctor(req, res) {
  try {
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
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
}

async function updateForDoctor(req, res) {
  try {
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
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
}

async function deleteForDoctor(req, res) {
  try {
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
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
}

async function listForPatient(req, res) {
  try {
    const medications = await treatmentMedicationService.listForPatient(
      req.user,
      req.params.planId,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Medications retrieved successfully",
      data: { medications },
    });
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
}

async function getForPatient(req, res) {
  try {
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
  } catch (error) {
    return handleTreatmentMedicationError(error, res);
  }
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
