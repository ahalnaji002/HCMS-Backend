const intakeCorrectionRequestService = require("../services/intakeCorrectionRequestService");

function handleError(error, res) {
  if (
    error instanceof
    intakeCorrectionRequestService.IntakeCorrectionPatientNotFoundError
  ) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (
    error instanceof
    intakeCorrectionRequestService.IntakeCorrectionRequestNotFoundError
  ) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (
    error instanceof
    intakeCorrectionRequestService.IntakeCorrectionRequestConflictError
  ) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (
    error instanceof
    intakeCorrectionRequestService.IntakeCorrectionRequestForbiddenError
  ) {
    return res.status(403).json({ success: false, message: error.message });
  }

  console.error("Intake correction request error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function listOwn(req, res) {
  try {
    const requests = await intakeCorrectionRequestService.listOwn(req.user);
    return res.status(200).json({
      success: true,
      message: "Intake correction requests retrieved successfully",
      data: { requests },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createOwn(req, res) {
  try {
    const request = await intakeCorrectionRequestService.createOwn(
      req.user,
      req.validatedCorrectionMessage,
    );
    return res.status(201).json({
      success: true,
      message: "Intake correction request submitted successfully",
      data: { request },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listForAdmin(req, res) {
  try {
    const requests = await intakeCorrectionRequestService.listForAdmin();
    return res.status(200).json({
      success: true,
      message: "Intake correction requests retrieved successfully",
      data: { requests },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function resolveForAdmin(req, res) {
  try {
    const request = await intakeCorrectionRequestService.resolveForAdmin(
      req.validatedCorrectionRequestId,
      req.user.id,
      req.validatedAdminResponse,
    );
    return res.status(200).json({
      success: true,
      message: "Intake correction request resolved successfully",
      data: { request },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = { createOwn, listForAdmin, listOwn, resolveForAdmin };
