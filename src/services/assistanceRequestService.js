const assistanceRequestModel = require("../models/assistanceRequestModel");
const db = require("../config/database");
const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const ngoModel = require("../models/ngoModel");
const patientModel = require("../models/patientModel");
const userModel = require("../models/userModel");
const notificationService = require("./notificationService");
const activityLogService = require("./activityLogService");

const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: new Set(["UNDER_REVIEW"]),
  UNDER_REVIEW: new Set(["APPROVED", "REJECTED"]),
  APPROVED: new Set(["COMPLETED"]),
};

class AssistanceRequestNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistanceRequestNotFoundError";
  }
}

class AssistanceRequestForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistanceRequestForbiddenError";
  }
}

class AssistanceRequestConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistanceRequestConflictError";
  }
}

class AssistanceRequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssistanceRequestValidationError";
  }
}

async function getPatientOrThrow(patientId) {
  const patient = await patientModel.findById(patientId);

  if (!patient) {
    throw new AssistanceRequestNotFoundError("Patient not found");
  }

  return patient;
}

async function getDoctorOrThrow(userId) {
  const doctor = await doctorModel.findByUserId(userId);

  if (!doctor) {
    throw new AssistanceRequestNotFoundError("Doctor profile not found");
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
    throw new AssistanceRequestForbiddenError(
      "Active Doctor-Patient Assignment required",
    );
  }

  return assignment;
}

async function getPatientProfileOrThrow(userId) {
  const patient = await patientModel.findByUserId(userId);

  if (!patient) {
    throw new AssistanceRequestNotFoundError("Patient profile not found");
  }

  return patient;
}

async function getNgoProfileOrThrow(userId) {
  const ngo = await ngoModel.findByUserId(userId);

  if (!ngo) {
    throw new AssistanceRequestNotFoundError("NGO profile not found");
  }

  return ngo;
}

async function createForAssignedPatient(
  user,
  patientId,
  requestData,
  ipAddress,
) {
  await getPatientOrThrow(patientId);

  const doctor = await getDoctorOrThrow(user.id);

  await requireActiveAssignment(doctor.id, patientId);

  return db.transaction(async (trx) => {
    const assistanceRequest = await assistanceRequestModel.create(
      {
        patient_id: patientId,
        doctor_id: doctor.id,
        request_type: requestData.request_type,
        description: requestData.description,
      },
      trx,
    );
    await activityLogService.recordEvent(
      {
        action: "CREATE_ASSISTANCE_REQUEST",
        actorUserId: user.id,
        entityId: assistanceRequest.id,
        ipAddress,
      },
      trx,
    );
    return assistanceRequest;
  });
}

async function listOwnRequests(user) {
  const patient = await getPatientProfileOrThrow(user.id);

  return assistanceRequestModel.listByPatientId(patient.id);
}

async function getOwnRequest(user, requestId) {
  const patient = await getPatientProfileOrThrow(user.id);
  const assistanceRequest = await assistanceRequestModel.findByIdAndPatientId(
    requestId,
    patient.id,
  );

  if (!assistanceRequest) {
    throw new AssistanceRequestNotFoundError("Assistance Request not found");
  }

  return assistanceRequest;
}

function listForAdmin() {
  return assistanceRequestModel.listAll();
}

async function getForAdmin(requestId) {
  const assistanceRequest = await assistanceRequestModel.findById(requestId);

  if (!assistanceRequest) {
    throw new AssistanceRequestNotFoundError("Assistance Request not found");
  }

  return assistanceRequest;
}

async function assignNgo(requestId, ngoId) {
  return db.transaction(async (trx) => {
    const assistanceRequest =
      await assistanceRequestModel.findByIdForUpdate(requestId, trx);

    if (!assistanceRequest) {
      throw new AssistanceRequestNotFoundError("Assistance Request not found");
    }

    if (
      assistanceRequest.status !== "PENDING" ||
      assistanceRequest.ngo_id !== null
    ) {
      throw new AssistanceRequestConflictError(
        "Assistance Request is not available for assignment",
      );
    }

    const ngo = await ngoModel.findByIdForUpdate(ngoId, trx);

    if (!ngo) {
      throw new AssistanceRequestNotFoundError("NGO not found");
    }

    const ngoUser = await userModel.findByIdForUpdate(ngo.user_id, trx);

    if (
      !ngoUser ||
      ngoUser.role !== "NGO" ||
      ngoUser.account_status !== "ACTIVE"
    ) {
      throw new AssistanceRequestValidationError(
        "NGO must have an active NGO user account",
      );
    }

    const assigned = await assistanceRequestModel.assignPendingToNgo(
      requestId,
      ngoId,
      trx,
    );

    if (!assigned) {
      throw new AssistanceRequestConflictError(
        "Assistance Request is not available for assignment",
      );
    }

    return assigned;
  });
}

async function listForNgo(user) {
  const ngo = await getNgoProfileOrThrow(user.id);
  return assistanceRequestModel.listByNgoId(ngo.id);
}

async function getForNgo(user, requestId) {
  const ngo = await getNgoProfileOrThrow(user.id);
  const assistanceRequest = await assistanceRequestModel.findByIdAndNgoId(
    requestId,
    ngo.id,
  );

  if (assistanceRequest) {
    return assistanceRequest;
  }

  const existing = await assistanceRequestModel.findById(requestId);

  if (existing) {
    throw new AssistanceRequestForbiddenError(
      "Assistance Request is assigned to another NGO",
    );
  }

  throw new AssistanceRequestNotFoundError("Assistance Request not found");
}

async function updateStatusForNgo(user, requestId, nextStatus, ipAddress) {
  const ngo = await getNgoProfileOrThrow(user.id);

  return db.transaction(async (trx) => {
    const assistanceRequest =
      await assistanceRequestModel.findByIdForUpdate(requestId, trx);

    if (!assistanceRequest) {
      throw new AssistanceRequestNotFoundError("Assistance Request not found");
    }

    if (String(assistanceRequest.ngo_id) !== String(ngo.id)) {
      throw new AssistanceRequestForbiddenError(
        "Assistance Request is assigned to another NGO",
      );
    }

    const allowedTargets = ALLOWED_STATUS_TRANSITIONS[assistanceRequest.status];

    if (!allowedTargets || !allowedTargets.has(nextStatus)) {
      throw new AssistanceRequestConflictError(
        "Invalid Assistance Request status transition",
      );
    }

    if (
      assistanceRequest.status === "APPROVED" &&
      nextStatus === "COMPLETED" &&
      !(await assistanceRequestModel.hasResourceAllocation(requestId, trx))
    ) {
      throw new AssistanceRequestConflictError(
        "At least one resource allocation is required before completing the assistance request.",
      );
    }

    const updated = await assistanceRequestModel.updateStatusConditionally(
      requestId,
      ngo.id,
      assistanceRequest.status,
      nextStatus,
      trx,
    );

    if (!updated) {
      throw new AssistanceRequestConflictError(
        "Assistance Request status changed concurrently",
      );
    }

    await notificationService.notifyAssistanceRequestStatusChanged(
      updated.id,
      assistanceRequest.status,
      nextStatus,
      trx,
    );
    await activityLogService.recordEvent(
      {
        action: "UPDATE_ASSISTANCE_STATUS",
        actorUserId: user.id,
        entityId: updated.id,
        ipAddress,
      },
      trx,
    );

    return updated;
  });
}

module.exports = {
  AssistanceRequestConflictError,
  AssistanceRequestForbiddenError,
  AssistanceRequestNotFoundError,
  AssistanceRequestValidationError,
  assignNgo,
  createForAssignedPatient,
  getForAdmin,
  getForNgo,
  getOwnRequest,
  listForAdmin,
  listForNgo,
  listOwnRequests,
  updateStatusForNgo,
};
