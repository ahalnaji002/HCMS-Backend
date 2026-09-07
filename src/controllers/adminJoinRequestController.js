const {
  InconsistentJoinRequestError,
  JoinRequestAlreadyReviewedError,
  JoinRequestNotFoundError,
  approveJoinRequest,
  getJoinRequest,
  listPendingJoinRequests,
  rejectJoinRequest,
} = require("../services/joinRequestReviewService");

function workflowErrorResponse(error, res) {
  if (error instanceof JoinRequestNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (
    error instanceof JoinRequestAlreadyReviewedError ||
    error instanceof InconsistentJoinRequestError
  ) {
    return res.status(409).json({ success: false, message: error.message });
  }
  return undefined;
}

// ==============================
// Join Request Review
// ==============================

async function listPending(req, res) {
  try {
    const requests = await listPendingJoinRequests();
    return res.status(200).json({
      success: true,
      message: "Pending join requests retrieved successfully",
      data: { join_requests: requests },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function show(req, res) {
  try {
    const request = await getJoinRequest(req.validatedJoinRequestId);
    return res.status(200).json({
      success: true,
      message: "Join request retrieved successfully",
      data: { join_request: request },
    });
  } catch (error) {
    return (
      workflowErrorResponse(error, res) ||
      res.status(500).json({ success: false, message: "Internal server error" })
    );
  }
}

async function approve(req, res) {
  try {
    const request = await approveJoinRequest(
      req.validatedJoinRequestId,
      req.user.id
    );
    return res.status(200).json({
      success: true,
      message: "Join request approved successfully",
      data: { join_request: request },
    });
  } catch (error) {
    return (
      workflowErrorResponse(error, res) ||
      res.status(500).json({ success: false, message: "Internal server error" })
    );
  }
}

async function reject(req, res) {
  try {
    const request = await rejectJoinRequest(
      req.validatedJoinRequestId,
      req.user.id,
      req.validatedRejectionReason
    );
    return res.status(200).json({
      success: true,
      message: "Join request rejected successfully",
      data: { join_request: request },
    });
  } catch (error) {
    return (
      workflowErrorResponse(error, res) ||
      res.status(500).json({ success: false, message: "Internal server error" })
    );
  }
}

module.exports = {
  approve,
  listPending,
  reject,
  show,
};
