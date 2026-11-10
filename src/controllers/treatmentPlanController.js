const treatmentPlanService = require("../services/treatmentPlanService");

async function createForAssignedPatient(req, res) {
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
}

async function listForAssignedPatient(req, res) {
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
}

async function getForAssignedPatient(req, res) {
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
}

async function updateForAssignedPatient(req, res) {
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
}

async function listOwnTreatmentPlans(req, res) {
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
}

async function getOwnTreatmentPlan(req, res) {
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
}

module.exports = {
  createForAssignedPatient,
  listForAssignedPatient,
  getForAssignedPatient,
  updateForAssignedPatient,
  listOwnTreatmentPlans,
  getOwnTreatmentPlan,
};
