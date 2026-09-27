const db = require("../config/database");
const patientModel = require("../models/patientModel");
const reminderModel = require("../models/reminderModel");
const treatmentAppointmentModel = require("../models/treatmentAppointmentModel");
const treatmentMedicationModel = require("../models/treatmentMedicationModel");
const treatmentPlanModel = require("../models/treatmentPlanModel");
const notificationService = require("./notificationService");

const REFERENCE_TYPES = {
  MEDICATION: "TREATMENT_MEDICATION",
  APPOINTMENT: "TREATMENT_APPOINTMENT",
};

class ReminderNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReminderNotFoundError";
  }
}

class ReminderForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReminderForbiddenError";
  }
}

class ReminderConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReminderConflictError";
  }
}

function formatLocalDateTime(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

async function getPatientProfileOrThrow(userId) {
  const patient = await patientModel.findByUserId(userId);

  if (!patient) {
    throw new ReminderNotFoundError("Patient profile not found");
  }

  return patient;
}

async function getReferenceOrThrow(type, referenceId) {
  const model =
    type === "MEDICATION"
      ? treatmentMedicationModel
      : treatmentAppointmentModel;
  const reference = await model.findById(referenceId);

  if (!reference) {
    throw new ReminderNotFoundError("Reminder reference not found");
  }

  return reference;
}

async function requirePatientReferenceOwnership(patientId, reference) {
  const plan = await treatmentPlanModel.findById(reference.treatment_plan_id);

  if (!plan) {
    throw new ReminderNotFoundError("Treatment Plan not found");
  }

  if (String(plan.patient_id) !== String(patientId)) {
    throw new ReminderForbiddenError("Reminder reference access forbidden");
  }
}

async function createOwnReminder(user, reminderData) {
  const patient = await getPatientProfileOrThrow(user.id);
  const reference = await getReferenceOrThrow(
    reminderData.type,
    reminderData.reference_id,
  );
  await requirePatientReferenceOwnership(patient.id, reference);

  return reminderModel.create({
    user_id: user.id,
    type: reminderData.type,
    reference_type: REFERENCE_TYPES[reminderData.type],
    reference_id: reminderData.reference_id,
    remind_at: reminderData.remind_at,
  });
}

function listOwnReminders(user) {
  return reminderModel.listByUserId(user.id);
}

async function getOwnReminder(user, reminderId) {
  const reminder = await reminderModel.findByIdAndUserId(reminderId, user.id);

  if (!reminder) {
    throw new ReminderNotFoundError("Reminder not found");
  }

  return reminder;
}

async function cancelOwnReminder(user, reminderId) {
  return db.transaction(async (trx) => {
    const reminder = await reminderModel.findByIdForUpdate(reminderId, trx);

    if (!reminder || String(reminder.user_id) !== String(user.id)) {
      throw new ReminderNotFoundError("Reminder not found");
    }

    if (reminder.status !== "PENDING") {
      throw new ReminderConflictError("Only pending Reminders can be cancelled");
    }

    const cancelledReminder = await reminderModel.cancelPending(
      reminder.id,
      user.id,
      trx,
    );

    if (!cancelledReminder) {
      throw new ReminderConflictError("Reminder can no longer be cancelled");
    }

    return cancelledReminder;
  });
}

async function deliverReminder(reminderId, currentTime = new Date()) {
  const formattedCurrentTime = formatLocalDateTime(currentTime);

  return db.transaction(async (trx) => {
    const reminder = await reminderModel.findByIdForUpdate(reminderId, trx);

    if (
      !reminder ||
      reminder.status !== "PENDING" ||
      new Date(reminder.remind_at).getTime() > currentTime.getTime()
    ) {
      return null;
    }

    await notificationService.notifyReminderDue(
      reminder.id,
      reminder.user_id,
      trx,
    );

    const sentReminder = await reminderModel.markPendingSent(
      reminder.id,
      formattedCurrentTime,
      trx,
    );

    if (!sentReminder) {
      throw new ReminderConflictError("Reminder can no longer be delivered");
    }

    return sentReminder;
  });
}

async function deliverDueReminders(currentTime = new Date()) {
  const dueReminders = await reminderModel.listDuePendingIds(
    formatLocalDateTime(currentTime),
  );
  const results = [];

  for (const reminder of dueReminders) {
    try {
      const delivered = await deliverReminder(reminder.id, currentTime);
      if (delivered) {
        results.push(delivered);
      }
    } catch (error) {
      console.error(`Reminder delivery failed for ${reminder.id}:`, error);
    }
  }

  return results;
}

module.exports = {
  ReminderConflictError,
  ReminderForbiddenError,
  ReminderNotFoundError,
  cancelOwnReminder,
  createOwnReminder,
  deliverDueReminders,
  deliverReminder,
  formatLocalDateTime,
  getOwnReminder,
  listOwnReminders,
};
