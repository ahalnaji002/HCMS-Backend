const doctorModel = require("../models/doctorModel");
const patientModel = require("../models/patientModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const treatmentPlanModel = require("../models/treatmentPlanModel");
const treatmentMedicationModel = require("../models/treatmentMedicationModel");

class TreatmentMedicationNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentMedicationNotFoundError";
  }
}

class TreatmentMedicationForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentMedicationForbiddenError";
  }
}

async function getPlanOrThrow(planId) {
  const plan = await treatmentPlanModel.findById(planId);

  if (!plan) {
    throw new TreatmentMedicationNotFoundError("Treatment Plan not found");
  }

  return plan;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new TreatmentMedicationNotFoundError("Doctor profile not found");
  }

  return doctor;
}

async function requireActiveAssignment(doctorId, patientId) {
  const assignment =
    await doctorPatientAssignmentModel.findActiveByDoctorAndPatient(
      doctorId,
      patientId,
    );

  if (!assignment) {
    throw new TreatmentMedicationForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }
}

async function authorizeDoctorForPlan(user, planId) {
  const plan = await getPlanOrThrow(planId);
  const doctor = await getDoctorOrThrow(user.id);
  await requireActiveAssignment(doctor.id, plan.patient_id);
  return plan;
}

async function authorizePatientForPlan(user, planId) {
  const patient = await patientModel.findByUserId(user.id);

  if (!patient) {
    throw new TreatmentMedicationNotFoundError("Patient profile not found");
  }

  const plan = await treatmentPlanModel.findByIdAndPatientId(
    planId,
    patient.id,
  );

  if (!plan) {
    throw new TreatmentMedicationNotFoundError("Treatment Plan not found");
  }

  return plan;
}

async function getMedicationOrThrow(planId, medicationId) {
  const medication = await treatmentMedicationModel.findByIdAndPlanId(
    medicationId,
    planId,
  );

  if (!medication) {
    throw new TreatmentMedicationNotFoundError("Treatment Medication not found");
  }

  return medication;
}

async function createForPlan(user, planId, medicationData) {
  await authorizeDoctorForPlan(user, planId);

  return treatmentMedicationModel.create({
    treatment_plan_id: planId,
    ...medicationData,
  });
}

async function listForDoctor(user, planId) {
  await authorizeDoctorForPlan(user, planId);
  return treatmentMedicationModel.listByPlanId(planId);
}

async function getForDoctor(user, planId, medicationId) {
  await authorizeDoctorForPlan(user, planId);
  return getMedicationOrThrow(planId, medicationId);
}

async function updateForDoctor(user, planId, medicationId, updates) {
  await authorizeDoctorForPlan(user, planId);
  await getMedicationOrThrow(planId, medicationId);

  return treatmentMedicationModel.updateByIdAndPlanId(
    medicationId,
    planId,
    updates,
  );
}

async function deleteForDoctor(user, planId, medicationId) {
  await authorizeDoctorForPlan(user, planId);
  const medication = await getMedicationOrThrow(planId, medicationId);
  await treatmentMedicationModel.deleteByIdAndPlanId(medicationId, planId);
  return medication;
}

async function listForPatient(user, planId) {
  await authorizePatientForPlan(user, planId);
  return treatmentMedicationModel.listByPlanId(planId);
}

async function getForPatient(user, planId, medicationId) {
  await authorizePatientForPlan(user, planId);
  return getMedicationOrThrow(planId, medicationId);
}

module.exports = {
  TreatmentMedicationForbiddenError,
  TreatmentMedicationNotFoundError,
  createForPlan,
  deleteForDoctor,
  getForDoctor,
  getForPatient,
  listForDoctor,
  listForPatient,
  updateForDoctor,
};
