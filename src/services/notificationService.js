const assistanceRequestModel = require("../models/assistanceRequestModel");
const doctorModel = require("../models/doctorModel");
const emergencyAlertModel = require("../models/emergencyAlertModel");
const notificationModel = require("../models/notificationModel");
const patientModel = require("../models/patientModel");
const treatmentPlanModel = require("../models/treatmentPlanModel");
const db = require("../config/database");

const UNSIGNED_BIGINT_MAX = 18446744073709551615n;
const ALLOWED_REFERENCE_TYPES = new Set([
  "ASSISTANCE_REQUEST",
  "EMERGENCY_ALERT",
  "TREATMENT_PLAN",
]);
const ASSISTANCE_STATUS_TRANSITIONS = new Set([
  "PENDING:UNDER_REVIEW",
  "UNDER_REVIEW:APPROVED",
  "UNDER_REVIEW:REJECTED",
  "APPROVED:COMPLETED",
]);
const EMERGENCY_STATUS_TRANSITIONS = new Set([
  "ASSIGNED:IN_PROGRESS",
  "IN_PROGRESS:RESOLVED",
]);

class NotificationNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotificationNotFoundError";
  }
}

class NotificationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

function normalizePositiveId(value, fieldName) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new NotificationValidationError(
        `${fieldName} must be a positive integer`,
      );
    }

    return String(value);
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new NotificationValidationError(
      `${fieldName} must be a positive integer`,
    );
  }

  try {
    if (BigInt(value) > UNSIGNED_BIGINT_MAX) {
      throw new NotificationValidationError(
        `${fieldName} must be a positive integer`,
      );
    }
  } catch (error) {
    if (error instanceof NotificationValidationError) {
      throw error;
    }

    throw new NotificationValidationError(
      `${fieldName} must be a positive integer`,
    );
  }

  return value;
}

async function validateReference(referenceType, referenceId, connection = db) {
  if (!ALLOWED_REFERENCE_TYPES.has(referenceType)) {
    throw new NotificationValidationError(
      "Unsupported notification reference_type",
    );
  }

  const normalizedId = normalizePositiveId(referenceId, "reference_id");
  const modelByType = {
    ASSISTANCE_REQUEST: assistanceRequestModel,
    EMERGENCY_ALERT: emergencyAlertModel,
    TREATMENT_PLAN: treatmentPlanModel,
  };
  const referencedEntity = await modelByType[referenceType].findById(
    normalizedId,
    connection,
  );

  if (!referencedEntity) {
    throw new NotificationNotFoundError(
      "Notification reference not found",
    );
  }

  return referencedEntity;
}

function createInternalNotification(notification, connection) {
  const userId = normalizePositiveId(notification.user_id, "user_id");
  const referenceId = normalizePositiveId(
    notification.reference_id,
    "reference_id",
  );

  if (
    typeof notification.title !== "string" ||
    notification.title.length === 0 ||
    notification.title.length > 150
  ) {
    throw new NotificationValidationError(
      "Notification title must contain 1 to 150 characters",
    );
  }

  if (
    typeof notification.message !== "string" ||
    notification.message.length === 0 ||
    Buffer.byteLength(notification.message, "utf8") > 65535
  ) {
    throw new NotificationValidationError(
      "Notification message must contain 1 to 65535 bytes",
    );
  }

  if (
    !ALLOWED_REFERENCE_TYPES.has(notification.reference_type) ||
    notification.type !== notification.reference_type
  ) {
    throw new NotificationValidationError(
      "Notification type and reference_type must use an approved value",
    );
  }

  return notificationModel.create(
    {
      ...notification,
      user_id: userId,
      reference_id: referenceId,
    },
    connection,
  );
}

async function notifyEmergencyAlertAssigned(alertId, connection) {
  const alert = await validateReference(
    "EMERGENCY_ALERT",
    alertId,
    connection,
  );

  if (!alert.assigned_doctor_id || alert.status !== "ASSIGNED") {
    throw new NotificationValidationError(
      "Emergency Alert is not assigned to a Doctor",
    );
  }

  const doctor = await doctorModel.findById(
    alert.assigned_doctor_id,
    connection,
  );

  if (!doctor) {
    throw new NotificationNotFoundError("Assigned Doctor not found");
  }

  return createInternalNotification(
    {
      user_id: doctor.user_id,
      title: "Emergency Alert assigned",
      message: `Emergency Alert #${alert.id} has been assigned to you.`,
      type: "EMERGENCY_ALERT",
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    },
    connection,
  );
}

async function notifyEmergencyAlertStatusChanged(
  alertId,
  previousStatus,
  nextStatus,
  connection,
) {
  if (!EMERGENCY_STATUS_TRANSITIONS.has(`${previousStatus}:${nextStatus}`)) {
    throw new NotificationValidationError(
      "Unsupported Emergency Alert status notification",
    );
  }

  const alert = await validateReference(
    "EMERGENCY_ALERT",
    alertId,
    connection,
  );

  if (alert.status !== nextStatus) {
    throw new NotificationValidationError(
      "Emergency Alert status does not match notification event",
    );
  }

  if (alert.patient_id === null) {
    return null;
  }

  const patient = await patientModel.findById(alert.patient_id, connection);

  if (!patient) {
    throw new NotificationNotFoundError("Emergency Alert Patient not found");
  }

  return createInternalNotification(
    {
      user_id: patient.user_id,
      title: "Emergency Alert status updated",
      message: `Emergency Alert #${alert.id} is now ${nextStatus}.`,
      type: "EMERGENCY_ALERT",
      reference_type: "EMERGENCY_ALERT",
      reference_id: alert.id,
    },
    connection,
  );
}

async function notifyTreatmentPlanUpdated(planId, connection) {
  const treatmentPlan = await validateReference(
    "TREATMENT_PLAN",
    planId,
    connection,
  );
  const patient = await patientModel.findById(
    treatmentPlan.patient_id,
    connection,
  );

  if (!patient) {
    throw new NotificationNotFoundError("Treatment Plan Patient not found");
  }

  return createInternalNotification(
    {
      user_id: patient.user_id,
      title: "Treatment Plan updated",
      message: `Treatment Plan #${treatmentPlan.id} has been updated.`,
      type: "TREATMENT_PLAN",
      reference_type: "TREATMENT_PLAN",
      reference_id: treatmentPlan.id,
    },
    connection,
  );
}

async function notifyAssistanceRequestStatusChanged(
  requestId,
  previousStatus,
  nextStatus,
  connection,
) {
  if (!ASSISTANCE_STATUS_TRANSITIONS.has(`${previousStatus}:${nextStatus}`)) {
    throw new NotificationValidationError(
      "Unsupported Assistance Request status notification",
    );
  }

  const assistanceRequest = await validateReference(
    "ASSISTANCE_REQUEST",
    requestId,
    connection,
  );

  if (assistanceRequest.status !== nextStatus) {
    throw new NotificationValidationError(
      "Assistance Request status does not match notification event",
    );
  }

  const [patient, doctor] = await Promise.all([
    patientModel.findById(assistanceRequest.patient_id, connection),
    doctorModel.findById(assistanceRequest.doctor_id, connection),
  ]);

  if (!patient || !doctor) {
    throw new NotificationNotFoundError(
      "Assistance Request recipient profile not found",
    );
  }

  const notification = {
    title: "Assistance Request status updated",
    message: `Assistance Request #${assistanceRequest.id} is now ${nextStatus}.`,
    type: "ASSISTANCE_REQUEST",
    reference_type: "ASSISTANCE_REQUEST",
    reference_id: assistanceRequest.id,
  };

  const patientNotification = await createInternalNotification(
    { ...notification, user_id: patient.user_id },
    connection,
  );
  const doctorNotification = await createInternalNotification(
    { ...notification, user_id: doctor.user_id },
    connection,
  );

  return [patientNotification, doctorNotification];
}

function listOwnNotifications(user) {
  return notificationModel.listByUserId(user.id);
}

function getOwnUnreadCount(user) {
  return notificationModel.countUnreadByUserId(user.id);
}

async function markOwnNotificationRead(user, notificationId) {
  const notification = await notificationModel.findByIdAndUserId(
    notificationId,
    user.id,
  );

  if (!notification) {
    throw new NotificationNotFoundError("Notification not found");
  }

  if (notification.is_read) {
    return notification;
  }

  return notificationModel.markReadByIdAndUserId(notificationId, user.id);
}

function markAllOwnNotificationsRead(user) {
  return notificationModel.markAllReadByUserId(user.id);
}

module.exports = {
  NotificationNotFoundError,
  NotificationValidationError,
  getOwnUnreadCount,
  listOwnNotifications,
  markAllOwnNotificationsRead,
  markOwnNotificationRead,
  notifyAssistanceRequestStatusChanged,
  notifyEmergencyAlertAssigned,
  notifyEmergencyAlertStatusChanged,
  notifyTreatmentPlanUpdated,
  validateReference,
};
