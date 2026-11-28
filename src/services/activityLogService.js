const activityLogModel = require("../models/activityLogModel");
const assistanceRequestModel = require("../models/assistanceRequestModel");
const emergencyAlertModel = require("../models/emergencyAlertModel");
const joinRequestModel = require("../models/joinRequestModel");
const resourceAllocationModel = require("../models/resourceAllocationModel");
const systemSettingModel = require("../models/systemSettingModel");
const userModel = require("../models/userModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const doctorModel = require("../models/doctorModel");
const treatmentPlanModel = require("../models/treatmentPlanModel");
const { NotFoundError } = require("../utils/apiErrors");

const UNSIGNED_BIGINT_MAX = 18446744073709551615n;

const EVENT_DEFINITIONS = Object.freeze({
  APPROVE_JOIN_REQUEST: {
    entityType: "JOIN_REQUEST",
    description: (id) => `Join Request #${id} approved.`,
  },
  REJECT_JOIN_REQUEST: {
    entityType: "JOIN_REQUEST",
    description: (id) => `Join Request #${id} rejected.`,
  },
  ASSIGN_EMERGENCY_ALERT: {
    entityType: "EMERGENCY_ALERT",
    description: (id) => `Emergency Alert #${id} assigned.`,
  },
  UPDATE_EMERGENCY_STATUS: {
    entityType: "EMERGENCY_ALERT",
    description: (id, entity) =>
      `Emergency Alert #${id} status updated to ${entity.status}.`,
  },
  CREATE_ASSISTANCE_REQUEST: {
    entityType: "ASSISTANCE_REQUEST",
    description: (id) => `Assistance Request #${id} created.`,
  },
  UPDATE_ASSISTANCE_STATUS: {
    entityType: "ASSISTANCE_REQUEST",
    description: (id, entity) =>
      `Assistance Request #${id} status updated to ${entity.status}.`,
  },
  CREATE_RESOURCE_ALLOCATION: {
    entityType: "RESOURCE_ALLOCATION",
    description: (id) => `Resource Allocation #${id} created.`,
  },
  UPDATE_RESOURCE_ALLOCATION: {
    entityType: "RESOURCE_ALLOCATION",
    description: (id) => `Resource Allocation #${id} updated.`,
  },
  DELETE_RESOURCE_ALLOCATION: {
    entityType: "RESOURCE_ALLOCATION",
    description: (id) => `Resource Allocation #${id} deleted.`,
  },
  UPDATE_SYSTEM_SETTING: {
    entityType: "SYSTEM_SETTING",
    description: (id) => `System Setting #${id} updated`,
  },
  ACTIVATE_USER: {
    entityType: "USER",
    description: (id, entity) => `User #${id} (${entity.role}) activated.`,
  },
  DEACTIVATE_USER: {
    entityType: "USER",
    description: (id, entity) => `User #${id} (${entity.role}) deactivated.`,
  },
  // Sign-ins. A failed sign-in for an email that has no account is logged
  // with no actor and no entity; the email itself is never stored.
  LOGIN_SUCCESS: {
    entityType: "USER",
    description: (id) => `User #${id} signed in.`,
  },
  LOGIN_FAILED: {
    entityType: "USER",
    allowAnonymous: true,
    description: (id) =>
      id ? `Failed sign-in for User #${id}.` : "Failed sign-in for an unknown email.",
  },
  CHANGE_PASSWORD: {
    entityType: "USER",
    description: (id) => `User #${id} changed their password.`,
  },
  // Care coordination and clinical changes: who did what and when, never
  // the content of the record.
  CREATE_DOCTOR_PATIENT_ASSIGNMENT: {
    entityType: "DOCTOR_PATIENT_ASSIGNMENT",
    description: (id) => `Doctor-patient assignment #${id} created.`,
  },
  UPDATE_DOCTOR_PATIENT_ASSIGNMENT_STATUS: {
    entityType: "DOCTOR_PATIENT_ASSIGNMENT",
    description: (id, entity) =>
      `Doctor-patient assignment #${id} status updated to ${entity.status}.`,
  },
  START_INTAKE_REVIEW: {
    entityType: "PATIENT_INTAKE",
    description: (id) => `Patient intake #${id} moved to review.`,
  },
  UPDATE_DOCTOR_WORKLOAD: {
    entityType: "DOCTOR",
    description: (id) => `Doctor #${id} workload settings updated.`,
  },
  CREATE_MEDICAL_RECORD: {
    entityType: "MEDICAL_RECORD",
    description: (id) => `Medical record #${id} created.`,
  },
  UPDATE_MEDICAL_RECORD: {
    entityType: "MEDICAL_RECORD",
    description: (id) => `Medical record #${id} updated.`,
  },
  CREATE_DIAGNOSIS: {
    entityType: "DOCTOR_DIAGNOSIS",
    description: (id) => `Diagnosis #${id} recorded.`,
  },
  CREATE_TREATMENT_PLAN: {
    entityType: "TREATMENT_PLAN",
    description: (id) => `Treatment plan #${id} created.`,
  },
  UPDATE_TREATMENT_PLAN: {
    entityType: "TREATMENT_PLAN",
    description: (id) => `Treatment plan #${id} updated.`,
  },
});

const APPROVED_ACTIONS = Object.freeze(Object.keys(EVENT_DEFINITIONS));
const APPROVED_ENTITY_TYPES = Object.freeze([
  "JOIN_REQUEST",
  "EMERGENCY_ALERT",
  "ASSISTANCE_REQUEST",
  "RESOURCE_ALLOCATION",
  "SYSTEM_SETTING",
  "USER",
  "DOCTOR_PATIENT_ASSIGNMENT",
  "PATIENT_INTAKE",
  "DOCTOR",
  "MEDICAL_RECORD",
  "DOCTOR_DIAGNOSIS",
  "TREATMENT_PLAN",
]);

const ENTITY_MODELS = {
  JOIN_REQUEST: joinRequestModel,
  EMERGENCY_ALERT: emergencyAlertModel,
  ASSISTANCE_REQUEST: assistanceRequestModel,
  RESOURCE_ALLOCATION: resourceAllocationModel,
  SYSTEM_SETTING: systemSettingModel,
  USER: userModel,
  DOCTOR_PATIENT_ASSIGNMENT: doctorPatientAssignmentModel,
  DOCTOR: doctorModel,
  TREATMENT_PLAN: treatmentPlanModel,
};

// Entity types logged right after the service created or changed the row in
// the same transaction. Their models have no plain findById, and the row is
// known to exist, so no lookup is made.
const ENTITY_TYPES_WITHOUT_LOOKUP = new Set([
  "PATIENT_INTAKE",
  "MEDICAL_RECORD",
  "DOCTOR_DIAGNOSIS",
]);

class ActivityLogNotFoundError extends NotFoundError {
  constructor(message) {
    super(message);
    this.name = "ActivityLogNotFoundError";
  }
}

class ActivityLogValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ActivityLogValidationError";
  }
}

function normalizePositiveId(value, fieldName) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ActivityLogValidationError(
        `${fieldName} must be a positive integer`,
      );
    }
    return String(value);
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new ActivityLogValidationError(
      `${fieldName} must be a positive integer`,
    );
  }

  try {
    if (BigInt(value) > UNSIGNED_BIGINT_MAX) {
      throw new ActivityLogValidationError(
        `${fieldName} must be a positive integer`,
      );
    }
  } catch (error) {
    if (error instanceof ActivityLogValidationError) throw error;
    throw new ActivityLogValidationError(
      `${fieldName} must be a positive integer`,
    );
  }

  return value;
}

function normalizeIpAddress(ipAddress) {
  if (ipAddress === undefined || ipAddress === null) return null;
  if (typeof ipAddress !== "string" || ipAddress.length > 45) {
    throw new ActivityLogValidationError("Invalid Activity Log IP address");
  }
  return ipAddress;
}

async function recordEvent(
  { action, actorUserId, entityId, ipAddress },
  connection,
) {
  if (!connection) {
    throw new ActivityLogValidationError(
      "Activity Log creation requires a transaction",
    );
  }

  const definition = EVENT_DEFINITIONS[action];
  if (!definition) {
    throw new ActivityLogValidationError("Unsupported Activity Log action");
  }

  const anonymous =
    definition.allowAnonymous && (actorUserId === null || actorUserId === undefined);
  const normalizedActorId = anonymous
    ? null
    : normalizePositiveId(actorUserId, "user_id");
  const normalizedEntityId =
    definition.allowAnonymous && (entityId === null || entityId === undefined)
      ? null
      : normalizePositiveId(entityId, "entity_id");
  let entity = null;

  if (
    normalizedEntityId !== null &&
    action !== "DELETE_RESOURCE_ALLOCATION" &&
    !ENTITY_TYPES_WITHOUT_LOOKUP.has(definition.entityType)
  ) {
    entity = await ENTITY_MODELS[definition.entityType].findById(
      normalizedEntityId,
      connection,
    );
    if (!entity) {
      throw new ActivityLogNotFoundError("Activity Log entity not found");
    }
  }

  return activityLogModel.create(
    {
      user_id: normalizedActorId,
      action,
      entity_type: normalizedEntityId === null ? null : definition.entityType,
      entity_id: normalizedEntityId,
      description: definition.description(normalizedEntityId, entity),
      ip_address: normalizeIpAddress(ipAddress),
    },
    connection,
  );
}

/**
 * Records an event for an action taken through the API. `actor` is
 * `{ userId, ipAddress }` from the request; when a service is called
 * without one (scripts, direct service tests) nothing is recorded.
 */
function recordActorEvent(actor, action, entityId, connection) {
  if (!actor) return null;
  return recordEvent(
    { action, actorUserId: actor.userId, entityId, ipAddress: actor.ipAddress },
    connection,
  );
}

async function listActivityLogs(query) {
  const result = await activityLogModel.listPaginated(
    query.filters,
    query.page,
    query.limit,
  );

  return {
    items: result.items,
    page: query.page,
    limit: query.limit,
    total: result.total,
    total_pages: Math.ceil(result.total / query.limit),
  };
}

async function getActivityLog(logId) {
  const activityLog = await activityLogModel.findById(logId);
  if (!activityLog) {
    throw new ActivityLogNotFoundError("Activity Log not found");
  }
  return activityLog;
}

module.exports = {
  APPROVED_ACTIONS,
  APPROVED_ENTITY_TYPES,
  ActivityLogNotFoundError,
  ActivityLogValidationError,
  getActivityLog,
  listActivityLogs,
  normalizePositiveId,
  recordActorEvent,
  recordEvent,
};
