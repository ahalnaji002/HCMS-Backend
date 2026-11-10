const {
  approveJoinRequest,
  getJoinRequest,
  listPendingJoinRequests,
  rejectJoinRequest,
} = require("../services/joinRequestReviewService");

// ==============================
// Join Request Review
// ==============================

async function listPending(req, res) {
  const requests = await listPendingJoinRequests();
  return res.status(200).json({
    success: true,
    message: "Pending join requests retrieved successfully",
    data: { join_requests: requests },
  });
}

async function show(req, res) {
  const request = await getJoinRequest(req.validatedJoinRequestId);
  return res.status(200).json({
    success: true,
    message: "Join request retrieved successfully",
    data: { join_request: request },
  });
}

async function approve(req, res) {
  const request = await approveJoinRequest(
    req.validatedJoinRequestId,
    req.user.id,
    req.ip,
  );
  return res.status(200).json({
    success: true,
    message: "Join request approved successfully",
    data: { join_request: request },
  });
}

async function reject(req, res) {
  const request = await rejectJoinRequest(
    req.validatedJoinRequestId,
    req.user.id,
    req.validatedRejectionReason,
    req.ip,
  );
  return res.status(200).json({
    success: true,
    message: "Join request rejected successfully",
    data: { join_request: request },
  });
}

module.exports = {
  approve,
  listPending,
  reject,
  show,
};
