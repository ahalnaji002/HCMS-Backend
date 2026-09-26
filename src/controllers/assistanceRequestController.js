const assistanceRequestService = require("../services/assistanceRequestService");

function handleAssistanceRequestError(error, res) {
  if (error instanceof assistanceRequestService.AssistanceRequestNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof assistanceRequestService.AssistanceRequestForbiddenError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Assistance Request error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createForAssignedPatient(req, res) {
  try {
    const assistanceRequest =
      await assistanceRequestService.createForAssignedPatient(
        req.user,
        req.validatedAssistanceRequestPatientId,
        req.validatedAssistanceRequest,
      );

    return res.status(201).json({
      success: true,
      message: "Assistance Request created successfully",
      data: {
        assistance_request: assistanceRequest,
      },
    });
  } catch (error) {
    return handleAssistanceRequestError(error, res);
  }
}

async function listOwnRequests(req, res) {
  try {
    const assistanceRequests =
      await assistanceRequestService.listOwnRequests(req.user);

    return res.status(200).json({
      success: true,
      message: "Assistance Requests retrieved successfully",
      data: {
        assistance_requests: assistanceRequests,
      },
    });
  } catch (error) {
    return handleAssistanceRequestError(error, res);
  }
}

async function getOwnRequest(req, res) {
  try {
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
  } catch (error) {
    return handleAssistanceRequestError(error, res);
  }
}

module.exports = {
  createForAssignedPatient,
  getOwnRequest,
  listOwnRequests,
};
