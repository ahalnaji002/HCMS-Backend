const activityLogModel = require("../models/activityLogModel");
const assistanceRequestModel = require("../models/assistanceRequestModel");
const emergencyAlertModel = require("../models/emergencyAlertModel");
const joinRequestModel = require("../models/joinRequestModel");
const resourceAllocationModel = require("../models/resourceAllocationModel");

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
});

const APPROVED_ACTIONS = Object.freeze(Object.keys(EVENT_DEFINITIONS));
const APPROVED_ENTITY_TYPES = Object.freeze([
  "JOIN_REQUEST",
  "EMERGENCY_ALERT",
  "ASSISTANCE_REQUEST",
  "RESOURCE_ALLOCATION",
]);

const ENTITY_MODELS = {
  JOIN_REQUEST: joinRequestModel,
  EMERGENCY_ALERT: emergencyAlertModel,
  ASSISTANCE_REQUEST: assistanceRequestModel,
  RESOURCE_ALLOCATION: resourceAllocationModel,
};

class ActivityLogNotFoundError extends Error {
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

  const normalizedActorId = normalizePositiveId(actorUserId, "user_id");
  const normalizedEntityId = normalizePositiveId(entityId, "entity_id");
  let entity = null;

  if (action !== "DELETE_RESOURCE_ALLOCATION") {
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
      entity_type: definition.entityType,
      entity_id: normalizedEntityId,
      description: definition.description(normalizedEntityId, entity),
      ip_address: normalizeIpAddress(ipAddress),
    },
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
  recordEvent,
};
