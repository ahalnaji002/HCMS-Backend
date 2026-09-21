const patientModel = require("../models/patientModel");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const treatmentPlanModel = require("../models/treatmentPlanModel");

class TreatmentPlanNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentPlanNotFoundError";
  }
}

class TreatmentPlanForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentPlanForbiddenError";
  }
}

class TreatmentPlanValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentPlanValidationError";
  }
}

async function getPatientOrThrow(patientId) {
  const patient = await patientModel.findById(patientId);

  if (!patient) {
    throw new TreatmentPlanNotFoundError("Patient not found");
  }

  return patient;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new TreatmentPlanNotFoundError("Doctor profile not found");
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
    throw new TreatmentPlanForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }

  return assignment;
}

async function getTreatmentPlanOrThrow(planId, patientId) {
  const treatmentPlan = await treatmentPlanModel.findByIdAndPatientId(
    planId,
    patientId,
  );

  if (!treatmentPlan) {
    throw new TreatmentPlanNotFoundError("Treatment Plan not found");
  }

  return treatmentPlan;
}

function dateToComparableNumber(value) {
  if (value instanceof Date) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function validateResultingDateRange(startDate, endDate) {
  if (endDate === null || endDate === undefined) {
    return;
  }

  const startValue = dateToComparableNumber(startDate);
  const endValue = dateToComparableNumber(endDate);

  if (endValue < startValue) {
    throw new TreatmentPlanValidationError(
      "end_date must be greater than or equal to start_date",
    );
  }
}

async function createForAssignedPatient(user, patientId, treatmentPlanData) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  validateResultingDateRange(
    treatmentPlanData.start_date,
    treatmentPlanData.end_date ?? null,
  );

  return treatmentPlanModel.create({
    patient_id: patientId,
    doctor_id: doctor.id,
    title: treatmentPlanData.title,
    general_instructions: treatmentPlanData.general_instructions ?? null,
    start_date: treatmentPlanData.start_date,
    end_date: treatmentPlanData.end_date ?? null,
  });
}

async function listForAssignedPatient(user, patientId) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  return treatmentPlanModel.listByPatientId(patientId);
}

async function getForAssignedPatient(user, patientId, planId) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  return getTreatmentPlanOrThrow(planId, patientId);
}

async function updateForAssignedPatient(
  user,
  patientId,
  planId,
  treatmentPlanData,
) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  const existingPlan = await getTreatmentPlanOrThrow(planId, patientId);

  const resultingStartDate =
    treatmentPlanData.start_date ?? existingPlan.start_date;

  const resultingEndDate = Object.prototype.hasOwnProperty.call(
    treatmentPlanData,
    "end_date",
  )
    ? treatmentPlanData.end_date
    : existingPlan.end_date;

  validateResultingDateRange(resultingStartDate, resultingEndDate);

  return treatmentPlanModel.updateByIdAndPatientId(
    planId,
    patientId,
    treatmentPlanData,
  );
}

async function getPatientProfileOrThrow(userId) {
  const patient = await patientModel.findByUserId(userId);

  if (!patient) {
    throw new TreatmentPlanNotFoundError("Patient profile not found");
  }

  return patient;
}

async function listOwnTreatmentPlans(user) {
  const patient = await getPatientProfileOrThrow(user.id);

  return treatmentPlanModel.listByPatientId(patient.id);
}

async function getOwnTreatmentPlan(user, planId) {
  const patient = await getPatientProfileOrThrow(user.id);

  return getTreatmentPlanOrThrow(planId, patient.id);
}

module.exports = {
  TreatmentPlanForbiddenError,
  TreatmentPlanNotFoundError,
  TreatmentPlanValidationError,
  createForAssignedPatient,
  listForAssignedPatient,
  getForAssignedPatient,
  updateForAssignedPatient,
  listOwnTreatmentPlans,
  getOwnTreatmentPlan,
};
