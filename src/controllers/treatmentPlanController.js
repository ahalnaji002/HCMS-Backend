const treatmentPlanService = require("../services/treatmentPlanService");

function handleTreatmentPlanError(error, res) {
  if (error instanceof treatmentPlanService.TreatmentPlanValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof treatmentPlanService.TreatmentPlanForbiddenError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof treatmentPlanService.TreatmentPlanNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Treatment Plan error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createForAssignedPatient(req, res) {
  try {
    const treatmentPlan = await treatmentPlanService.createForAssignedPatient(
      req.user,
      req.params.patientId,
      req.validatedTreatmentPlan,
    );

    return res.status(201).json({
      success: true,
      message: "Treatment Plan created successfully",
      data: {
        treatment_plan: treatmentPlan,
      },
    });
  } catch (error) {
    return handleTreatmentPlanError(error, res);
  }
}

async function listForAssignedPatient(req, res) {
  try {
    const treatmentPlans = await treatmentPlanService.listForAssignedPatient(
      req.user,
      req.params.patientId,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Plans retrieved successfully",
      data: {
        treatment_plans: treatmentPlans,
      },
    });
  } catch (error) {
    return handleTreatmentPlanError(error, res);
  }
}

async function getForAssignedPatient(req, res) {
  try {
    const treatmentPlan = await treatmentPlanService.getForAssignedPatient(
      req.user,
      req.params.patientId,
      req.params.planId,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Plan retrieved successfully",
      data: {
        treatment_plan: treatmentPlan,
      },
    });
  } catch (error) {
    return handleTreatmentPlanError(error, res);
  }
}

async function updateForAssignedPatient(req, res) {
  try {
    const treatmentPlan = await treatmentPlanService.updateForAssignedPatient(
      req.user,
      req.params.patientId,
      req.params.planId,
      req.validatedTreatmentPlan,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Plan updated successfully",
      data: {
        treatment_plan: treatmentPlan,
      },
    });
  } catch (error) {
    return handleTreatmentPlanError(error, res);
  }
}

async function listOwnTreatmentPlans(req, res) {
  try {
    const treatmentPlans = await treatmentPlanService.listOwnTreatmentPlans(
      req.user,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Plans retrieved successfully",
      data: {
        treatment_plans: treatmentPlans,
      },
    });
  } catch (error) {
    return handleTreatmentPlanError(error, res);
  }
}

async function getOwnTreatmentPlan(req, res) {
  try {
    const treatmentPlan = await treatmentPlanService.getOwnTreatmentPlan(
      req.user,
      req.params.planId,
    );

    return res.status(200).json({
      success: true,
      message: "Treatment Plan retrieved successfully",
      data: {
        treatment_plan: treatmentPlan,
      },
    });
  } catch (error) {
    return handleTreatmentPlanError(error, res);
  }
}

module.exports = {
  createForAssignedPatient,
  listForAssignedPatient,
  getForAssignedPatient,
  updateForAssignedPatient,
  listOwnTreatmentPlans,
  getOwnTreatmentPlan,
};
