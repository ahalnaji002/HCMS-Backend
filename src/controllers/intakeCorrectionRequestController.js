const intakeCorrectionRequestService = require("../services/intakeCorrectionRequestService");

async function listOwn(req, res) {
  const requests = await intakeCorrectionRequestService.listOwn(req.user);
  return res.status(200).json({
    success: true,
    message: "Intake correction requests retrieved successfully",
    data: { requests },
  });
}

async function createOwn(req, res) {
  const request = await intakeCorrectionRequestService.createOwn(
    req.user,
    req.validatedCorrectionMessage,
  );
  return res.status(201).json({
    success: true,
    message: "Intake correction request submitted successfully",
    data: { request },
  });
}

async function listForAdmin(req, res) {
  const requests = await intakeCorrectionRequestService.listForAdmin();
  return res.status(200).json({
    success: true,
    message: "Intake correction requests retrieved successfully",
    data: { requests },
  });
}

async function resolveForAdmin(req, res) {
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
}

module.exports = { createOwn, listForAdmin, listOwn, resolveForAdmin };
