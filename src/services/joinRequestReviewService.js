const db = require("../config/database");
const joinRequestModel = require("../models/joinRequestModel");
const userModel = require("../models/userModel");
const activityLogService = require("./activityLogService");

class JoinRequestNotFoundError extends Error {
  constructor() {
    super("Join request not found");
    this.name = "JoinRequestNotFoundError";
  }
}

class JoinRequestAlreadyReviewedError extends Error {
  constructor() {
    super("Join request has already been reviewed");
    this.name = "JoinRequestAlreadyReviewedError";
  }
}

class InconsistentJoinRequestError extends Error {
  constructor() {
    super("Join request data is inconsistent");
    this.name = "InconsistentJoinRequestError";
  }
}

function formatDetailedJoinRequest(row) {
  if (!row) return undefined;

  const result = {
    id: row.id,
    user_id: row.user_id,
    request_type: row.request_type,
    status: row.status,
    reviewed_by_admin_id: row.reviewed_by_admin_id,
    reviewed_at: row.reviewed_at,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      full_name: row.user_full_name,
      email: row.user_email,
      role: row.user_role,
      account_status: row.user_account_status,
      phone: row.user_phone,
    },
  };

  if (row.request_type === "DOCTOR") {
    result.doctor = {
      specialization: row.doctor_specialization,
      license_number: row.doctor_license_number,
    };
  } else if (row.request_type === "NGO") {
    result.ngo = {
      organization_name: row.ngo_organization_name,
      registration_number: row.ngo_registration_number,
      address: row.ngo_address,
      contact_phone: row.ngo_contact_phone,
    };
  }

  return result;
}

async function listPendingJoinRequests() {
  const rows = await joinRequestModel.listPendingDetailed();
  return rows.map(formatDetailedJoinRequest);
}

async function getJoinRequest(id) {
  const row = await joinRequestModel.findDetailedById(id);
  if (!row) throw new JoinRequestNotFoundError();
  return formatDetailedJoinRequest(row);
}

async function validateLockedRequest(id, trx) {
  const request = await joinRequestModel.findByIdForUpdate(id, trx);
  if (!request) throw new JoinRequestNotFoundError();
  if (request.status !== "PENDING") {
    throw new JoinRequestAlreadyReviewedError();
  }
  if (request.request_type !== "DOCTOR" && request.request_type !== "NGO") {
    throw new InconsistentJoinRequestError();
  }

  const user = await userModel.findById(request.user_id, trx);
  if (
    !user ||
    user.role !== request.request_type ||
    user.account_status !== "INACTIVE"
  ) {
    throw new InconsistentJoinRequestError();
  }

  return request;
}

async function approveJoinRequest(id, adminId, ipAddress) {
  return db.transaction(async (trx) => {
    const request = await validateLockedRequest(id, trx);

    await joinRequestModel.updateReview(
      id,
      {
        status: "APPROVED",
        reviewed_by_admin_id: adminId,
        reviewed_at: db.fn.now(),
        rejection_reason: null,
      },
      trx
    );
    await userModel.updateAccountStatus(request.user_id, "ACTIVE", trx);

    const reviewed = await joinRequestModel.findDetailedById(id, trx);
    await activityLogService.recordEvent(
      {
        action: "APPROVE_JOIN_REQUEST",
        actorUserId: adminId,
        entityId: request.id,
        ipAddress,
      },
      trx,
    );
    return formatDetailedJoinRequest(reviewed);
  });
}

async function rejectJoinRequest(id, adminId, rejectionReason, ipAddress) {
  return db.transaction(async (trx) => {
    const request = await validateLockedRequest(id, trx);

    await joinRequestModel.updateReview(
      id,
      {
        status: "REJECTED",
        reviewed_by_admin_id: adminId,
        reviewed_at: db.fn.now(),
        rejection_reason: rejectionReason,
      },
      trx
    );

    const reviewed = await joinRequestModel.findDetailedById(id, trx);
    await activityLogService.recordEvent(
      {
        action: "REJECT_JOIN_REQUEST",
        actorUserId: adminId,
        entityId: request.id,
        ipAddress,
      },
      trx,
    );
    return formatDetailedJoinRequest(reviewed);
  });
}

module.exports = {
  InconsistentJoinRequestError,
  JoinRequestAlreadyReviewedError,
  JoinRequestNotFoundError,
  approveJoinRequest,
  getJoinRequest,
  listPendingJoinRequests,
  rejectJoinRequest,
};
