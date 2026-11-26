const db = require("../config/database");
const userModel = require("../models/userModel");
const ngoModel = require("../models/ngoModel");
const activityLogService = require("./activityLogService");
const { ConflictError, NotFoundError } = require("../utils/apiErrors");

// FR-10.1 / FR-10.2: Administrator user and organization management.
//
// Deactivation uses SUSPENDED, not INACTIVE: INACTIVE marks Doctor and NGO
// applicants waiting for (or rejected by) Join Request review, and the
// approval workflow relies on it. An administrator can therefore only
// suspend an ACTIVE account and re-activate a SUSPENDED one; applicants are
// activated through Join Requests only.
const STATUS_TRANSITIONS = {
  SUSPENDED: { from: "ACTIVE", action: "DEACTIVATE_USER" },
  ACTIVE: { from: "SUSPENDED", action: "ACTIVATE_USER" },
};

class UserManagementNotFoundError extends NotFoundError {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserManagementNotFoundError";
  }
}

class UserManagementConflictError extends ConflictError {
  constructor(message) {
    super(message);
    this.name = "UserManagementConflictError";
  }
}

async function listUsers({ filters, page, limit }) {
  const result = await userModel.listForAdmin(filters, page, limit);

  return {
    users: result.items,
    page,
    limit,
    total: result.total,
    total_pages: Math.ceil(result.total / limit),
  };
}

function listNgos({ filters }) {
  return ngoModel.listForAdmin(filters);
}

async function updateUserAccountStatus(adminUser, userId, nextStatus, ipAddress) {
  return db.transaction(async (trx) => {
    // Suspending an administrator locks every active administrator row (in
    // id order) before the target row, so concurrent requests queue instead
    // of deadlocking and each one re-checks the remaining count.
    const target = await userModel.findById(userId, trx);
    if (target?.role === "ADMIN" && nextStatus === "SUSPENDED") {
      await userModel.countActiveAdminsForUpdate(trx);
    }

    const user = await userModel.findByIdForUpdate(userId, trx);

    if (!user) {
      throw new UserManagementNotFoundError();
    }

    if (String(user.id) === String(adminUser.id)) {
      throw new UserManagementConflictError(
        "You cannot change the status of your own account",
      );
    }

    const transition = STATUS_TRANSITIONS[nextStatus];

    if (user.account_status === nextStatus) {
      throw new UserManagementConflictError(
        `User account is already ${nextStatus}`,
      );
    }

    if (user.account_status !== transition.from) {
      throw new UserManagementConflictError(
        user.account_status === "INACTIVE"
          ? "Accounts awaiting approval are activated through Join Requests"
          : "Invalid user account status transition",
      );
    }

    if (nextStatus === "SUSPENDED" && user.role === "ADMIN") {
      const activeAdmins = await userModel.countActiveAdminsForUpdate(trx);
      if (activeAdmins <= 1) {
        throw new UserManagementConflictError(
          "The last active administrator cannot be deactivated",
        );
      }
    }

    const updatedUser = await userModel.updateAccountStatus(user.id, nextStatus, trx);

    await activityLogService.recordEvent(
      {
        action: transition.action,
        actorUserId: adminUser.id,
        entityId: user.id,
        ipAddress,
      },
      trx,
    );

    return updatedUser;
  });
}

module.exports = {
  UserManagementNotFoundError,
  UserManagementConflictError,
  listUsers,
  listNgos,
  updateUserAccountStatus,
};
