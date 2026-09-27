const db = require("../config/database");
const assistanceRequestModel = require("../models/assistanceRequestModel");
const doctorModel = require("../models/doctorModel");
const ngoModel = require("../models/ngoModel");
const patientModel = require("../models/patientModel");
const resourceAllocationModel = require("../models/resourceAllocationModel");
const activityLogService = require("./activityLogService");

class ResourceAllocationNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResourceAllocationNotFoundError";
  }
}

class ResourceAllocationForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResourceAllocationForbiddenError";
  }
}

class ResourceAllocationConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResourceAllocationConflictError";
  }
}

async function getNgoProfileOrThrow(userId) {
  const ngo = await ngoModel.findByUserId(userId);

  if (!ngo) {
    throw new ResourceAllocationNotFoundError("NGO profile not found");
  }

  return ngo;
}

async function getRequestOrThrow(requestId, connection = db) {
  const assistanceRequest = await assistanceRequestModel.findById(
    requestId,
    connection,
  );

  if (!assistanceRequest) {
    throw new ResourceAllocationNotFoundError("Assistance Request not found");
  }

  return assistanceRequest;
}

async function getLockedRequestOrThrow(requestId, connection) {
  const assistanceRequest = await assistanceRequestModel.findByIdForUpdate(
    requestId,
    connection,
  );

  if (!assistanceRequest) {
    throw new ResourceAllocationNotFoundError("Assistance Request not found");
  }

  return assistanceRequest;
}

function requireNgoOwnership(assistanceRequest, ngoId) {
  if (String(assistanceRequest.ngo_id) !== String(ngoId)) {
    throw new ResourceAllocationForbiddenError(
      "Assistance Request is not assigned to this NGO",
    );
  }
}

function requireMutableRequest(assistanceRequest) {
  if (assistanceRequest.status === "COMPLETED") {
    throw new ResourceAllocationConflictError(
      "Resource Allocations are read-only after completion",
    );
  }
}

async function createForNgo(user, requestId, allocationData, ipAddress) {
  const ngo = await getNgoProfileOrThrow(user.id);

  return db.transaction(async (trx) => {
    const assistanceRequest = await getLockedRequestOrThrow(requestId, trx);
    requireNgoOwnership(assistanceRequest, ngo.id);

    if (assistanceRequest.status !== "APPROVED") {
      throw new ResourceAllocationConflictError(
        "Resource Allocations can only be created for approved Assistance Requests",
      );
    }

    const allocation = await resourceAllocationModel.create(
      {
        assistance_request_id: requestId,
        ...allocationData,
      },
      trx,
    );
    await activityLogService.recordEvent(
      {
        action: "CREATE_RESOURCE_ALLOCATION",
        actorUserId: user.id,
        entityId: allocation.id,
        ipAddress,
      },
      trx,
    );
    return allocation;
  });
}

async function listForNgo(user, requestId) {
  const ngo = await getNgoProfileOrThrow(user.id);
  const assistanceRequest = await getRequestOrThrow(requestId);
  requireNgoOwnership(assistanceRequest, ngo.id);
  return resourceAllocationModel.listByRequestId(requestId);
}

async function getLockedResourceOrThrow(resourceId, requestId, connection) {
  const allocation = await resourceAllocationModel.findByIdForUpdate(
    resourceId,
    connection,
  );

  if (
    !allocation ||
    String(allocation.assistance_request_id) !== String(requestId)
  ) {
    throw new ResourceAllocationNotFoundError("Resource Allocation not found");
  }

  return allocation;
}

async function updateForNgo(
  user,
  requestId,
  resourceId,
  updates,
  ipAddress,
) {
  const ngo = await getNgoProfileOrThrow(user.id);

  return db.transaction(async (trx) => {
    const assistanceRequest = await getLockedRequestOrThrow(requestId, trx);
    requireNgoOwnership(assistanceRequest, ngo.id);
    requireMutableRequest(assistanceRequest);
    await getLockedResourceOrThrow(resourceId, requestId, trx);

    const updated = await resourceAllocationModel.updateByIdAndRequestId(
      resourceId,
      requestId,
      updates,
      trx,
    );

    if (!updated) {
      throw new ResourceAllocationConflictError(
        "Resource Allocation changed concurrently",
      );
    }

    await activityLogService.recordEvent(
      {
        action: "UPDATE_RESOURCE_ALLOCATION",
        actorUserId: user.id,
        entityId: updated.id,
        ipAddress,
      },
      trx,
    );

    return updated;
  });
}

async function deleteForNgo(user, requestId, resourceId, ipAddress) {
  const ngo = await getNgoProfileOrThrow(user.id);

  return db.transaction(async (trx) => {
    const assistanceRequest = await getLockedRequestOrThrow(requestId, trx);
    requireNgoOwnership(assistanceRequest, ngo.id);
    requireMutableRequest(assistanceRequest);
    const allocation = await getLockedResourceOrThrow(
      resourceId,
      requestId,
      trx,
    );

    const affectedRows = await resourceAllocationModel.deleteByIdAndRequestId(
      resourceId,
      requestId,
      trx,
    );

    if (affectedRows === 0) {
      throw new ResourceAllocationConflictError(
        "Resource Allocation changed concurrently",
      );
    }

    await activityLogService.recordEvent(
      {
        action: "DELETE_RESOURCE_ALLOCATION",
        actorUserId: user.id,
        entityId: allocation.id,
        ipAddress,
      },
      trx,
    );

    return allocation;
  });
}

async function listForPatient(user, requestId) {
  const patient = await patientModel.findByUserId(user.id);

  if (!patient) {
    throw new ResourceAllocationNotFoundError("Patient profile not found");
  }

  const assistanceRequest = await assistanceRequestModel.findByIdAndPatientId(
    requestId,
    patient.id,
  );

  if (!assistanceRequest) {
    throw new ResourceAllocationNotFoundError("Assistance Request not found");
  }

  return resourceAllocationModel.listByRequestId(requestId);
}

async function listForDoctor(user, requestId) {
  const doctor = await doctorModel.findByUserId(user.id);

  if (!doctor) {
    throw new ResourceAllocationNotFoundError("Doctor profile not found");
  }

  const assistanceRequest = await getRequestOrThrow(requestId);

  if (String(assistanceRequest.doctor_id) !== String(doctor.id)) {
    throw new ResourceAllocationForbiddenError(
      "Assistance Request was created by another Doctor",
    );
  }

  return resourceAllocationModel.listByRequestId(requestId);
}

async function listForAdmin(requestId) {
  await getRequestOrThrow(requestId);
  return resourceAllocationModel.listByRequestId(requestId);
}

module.exports = {
  ResourceAllocationConflictError,
  ResourceAllocationForbiddenError,
  ResourceAllocationNotFoundError,
  createForNgo,
  deleteForNgo,
  listForAdmin,
  listForDoctor,
  listForNgo,
  listForPatient,
  updateForNgo,
};
