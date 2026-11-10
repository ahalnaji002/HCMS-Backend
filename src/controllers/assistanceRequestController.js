const assistanceRequestService = require("../services/assistanceRequestService");

async function createForAssignedPatient(req, res) {
  const assistanceRequest =
    await assistanceRequestService.createForAssignedPatient(
      req.user,
      req.validatedAssistanceRequestPatientId,
      req.validatedAssistanceRequest,
      req.ip,
    );

  return res.status(201).json({
    success: true,
    message: "Assistance Request created successfully",
    data: {
      assistance_request: assistanceRequest,
    },
  });
}

async function listOwnRequests(req, res) {
  const assistanceRequests =
    await assistanceRequestService.listOwnRequests(req.user);

  return res.status(200).json({
    success: true,
    message: "Assistance Requests retrieved successfully",
    data: {
      assistance_requests: assistanceRequests,
    },
  });
}

async function getOwnRequest(req, res) {
  const assistanceRequest = await assistanceRequestService.getOwnRequest(
    req.user,
    req.validatedAssistanceRequestId,
  );

  return res.status(200).json({
    success: true,
    message: "Assistance Request retrieved successfully",
    data: {
      assistance_request: assistanceRequest,
    },
  });
}

async function listForAdmin(req, res) {
  const assistanceRequests = await assistanceRequestService.listForAdmin();

  return res.status(200).json({
    success: true,
    message: "Assistance Requests retrieved successfully",
    data: {
      assistance_requests: assistanceRequests,
    },
  });
}

async function getForAdmin(req, res) {
  const assistanceRequest = await assistanceRequestService.getForAdmin(
    req.validatedAssistanceRequestId,
  );

  return res.status(200).json({
    success: true,
    message: "Assistance Request retrieved successfully",
    data: {
      assistance_request: assistanceRequest,
    },
  });
}

async function assignNgo(req, res) {
  const assistanceRequest = await assistanceRequestService.assignNgo(
    req.validatedAssistanceRequestId,
    req.validatedAssistanceRequestAssignment.ngo_id,
  );

  return res.status(200).json({
    success: true,
    message: "Assistance Request assigned successfully",
    data: {
      assistance_request: assistanceRequest,
    },
  });
}

async function listForNgo(req, res) {
  const assistanceRequests = await assistanceRequestService.listForNgo(
    req.user,
  );

  return res.status(200).json({
    success: true,
    message: "Assistance Requests retrieved successfully",
    data: {
      assistance_requests: assistanceRequests,
    },
  });
}

async function getForNgo(req, res) {
  const assistanceRequest = await assistanceRequestService.getForNgo(
    req.user,
    req.validatedAssistanceRequestId,
  );

  return res.status(200).json({
    success: true,
    message: "Assistance Request retrieved successfully",
    data: {
      assistance_request: assistanceRequest,
    },
  });
}

async function updateStatusForNgo(req, res) {
  const assistanceRequest =
    await assistanceRequestService.updateStatusForNgo(
      req.user,
      req.validatedAssistanceRequestId,
      req.validatedAssistanceRequestStatus.status,
      req.ip,
    );

  return res.status(200).json({
    success: true,
    message: "Assistance Request status updated successfully",
    data: {
      assistance_request: assistanceRequest,
    },
  });
}

module.exports = {
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
