const doctorDiagnosisService = require("../services/doctorDiagnosisService");

function handleError(error, res) {
  if (error instanceof doctorDiagnosisService.DoctorDiagnosisNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error instanceof doctorDiagnosisService.DoctorDiagnosisForbiddenError) {
    return res.status(403).json({ success: false, message: error.message });
  }
  console.error("Doctor diagnosis error:", error);
  return res.status(500).json({ success: false, message: "Internal server error" });
}

async function listForAssignedPatient(req, res) {
  try {
    const diagnoses = await doctorDiagnosisService.listForPatient(
      req.user,
      req.validatedPatientId,
    );
    return res.status(200).json({
      success: true,
      message: "Doctor diagnoses retrieved successfully",
      data: { diagnoses },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createForAssignedPatient(req, res) {
  try {
    const diagnosis = await doctorDiagnosisService.createForPatient(
      req.user,
      req.validatedPatientId,
      req.validatedDoctorDiagnosis,
    );
    return res.status(201).json({
      success: true,
      message: "Doctor diagnosis recorded successfully",
      data: { diagnosis },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function listOwn(req, res) {
  try {
    const diagnoses = await doctorDiagnosisService.listOwn(req.user);
    return res.status(200).json({
      success: true,
      message: "Patient diagnoses retrieved successfully",
      data: { diagnoses },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = { createForAssignedPatient, listForAssignedPatient, listOwn };
