const doctorModel = require("../models/doctorModel");
const patientModel = require("../models/patientModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const treatmentPlanModel = require("../models/treatmentPlanModel");
const treatmentAppointmentModel = require("../models/treatmentAppointmentModel");
const db = require("../config/database");

class TreatmentAppointmentNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentAppointmentNotFoundError";
  }
}

class TreatmentAppointmentForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "TreatmentAppointmentForbiddenError";
  }
}

class TreatmentAppointmentValidationError extends Error {
  constructor(errors) {
    super("Validation failed");
    this.name = "TreatmentAppointmentValidationError";
    this.errors = errors;
  }
}

async function getPlanOrThrow(planId) {
  const plan = await treatmentPlanModel.findById(planId);

  if (!plan) {
    throw new TreatmentAppointmentNotFoundError("Treatment Plan not found");
  }

  return plan;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new TreatmentAppointmentNotFoundError("Doctor profile not found");
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
    throw new TreatmentAppointmentForbiddenError(
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
    throw new TreatmentAppointmentNotFoundError("Patient profile not found");
  }

  const plan = await treatmentPlanModel.findByIdAndPatientId(
    planId,
    patient.id,
  );

  if (!plan) {
    throw new TreatmentAppointmentNotFoundError("Treatment Plan not found");
  }

  return plan;
}

async function getAppointmentOrThrow(planId, appointmentId) {
  const appointment = await treatmentAppointmentModel.findByIdAndPlanId(
    appointmentId,
    planId,
  );

  if (!appointment) {
    throw new TreatmentAppointmentNotFoundError(
      "Treatment Appointment not found",
    );
  }

  return appointment;
}

function dateOnly(value) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function validateAppointmentWithinPlan(appointmentDate, plan) {
  const appointmentDay = dateOnly(appointmentDate);
  const startDay = dateOnly(plan.start_date);
  const endDay = plan.end_date === null ? null : dateOnly(plan.end_date);

  if (appointmentDay < startDay || (endDay && appointmentDay > endDay)) {
    throw new TreatmentAppointmentValidationError({
      appointment_date:
        "appointment_date must fall within the Treatment Plan date range",
    });
  }
}

async function createForPlan(user, planId, appointmentData) {
  await authorizeDoctorForPlan(user, planId);
  return db.transaction(async (trx) => {
    const plan = await treatmentPlanModel.findByIdForUpdate(planId, trx);
    if (!plan) throw new TreatmentAppointmentNotFoundError("Treatment Plan not found");
    validateAppointmentWithinPlan(appointmentData.appointment_date, plan);
    return treatmentAppointmentModel.create({ treatment_plan_id: planId, ...appointmentData }, trx);
  });
}

async function listForDoctor(user, planId) {
  await authorizeDoctorForPlan(user, planId);
  return treatmentAppointmentModel.listByPlanId(planId);
}

async function getForDoctor(user, planId, appointmentId) {
  await authorizeDoctorForPlan(user, planId);
  return getAppointmentOrThrow(planId, appointmentId);
}

async function updateForDoctor(user, planId, appointmentId, updates) {
  await authorizeDoctorForPlan(user, planId);
  return db.transaction(async (trx) => {
    const plan = await treatmentPlanModel.findByIdForUpdate(planId, trx);
    if (!plan) throw new TreatmentAppointmentNotFoundError("Treatment Plan not found");
    await getAppointmentOrThrow(planId, appointmentId);
    if (updates.appointment_date !== undefined) validateAppointmentWithinPlan(updates.appointment_date, plan);
    return treatmentAppointmentModel.updateByIdAndPlanId(appointmentId, planId, updates, trx);
  });
}

async function deleteForDoctor(user, planId, appointmentId) {
  await authorizeDoctorForPlan(user, planId);
  return db.transaction(async (trx) => {
    await treatmentPlanModel.findByIdForUpdate(planId, trx);
    const appointment = await getAppointmentOrThrow(planId, appointmentId);
    await treatmentAppointmentModel.deleteByIdAndPlanId(appointmentId, planId, trx);
    return appointment;
  });
}

async function listForPatient(user, planId) {
  await authorizePatientForPlan(user, planId);
  return treatmentAppointmentModel.listByPlanId(planId);
}

async function getForPatient(user, planId, appointmentId) {
  await authorizePatientForPlan(user, planId);
  return getAppointmentOrThrow(planId, appointmentId);
}

module.exports = {
  TreatmentAppointmentForbiddenError,
  TreatmentAppointmentNotFoundError,
  TreatmentAppointmentValidationError,
  createForPlan,
  deleteForDoctor,
  getForDoctor,
  getForPatient,
  listForDoctor,
  listForPatient,
  updateForDoctor,
};
