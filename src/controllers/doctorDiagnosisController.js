const doctorDiagnosisService = require("../services/doctorDiagnosisService");

async function listForAssignedPatient(req, res) {
  const diagnoses = await doctorDiagnosisService.listForPatient(
    req.user,
    req.validatedPatientId,
  );
  return res.status(200).json({
    success: true,
    message: "Doctor diagnoses retrieved successfully",
    data: { diagnoses },
  });
}

async function createForAssignedPatient(req, res) {
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
}

async function listOwn(req, res) {
  const diagnoses = await doctorDiagnosisService.listOwn(req.user);
  return res.status(200).json({
    success: true,
    message: "Patient diagnoses retrieved successfully",
    data: { diagnoses },
  });
}

module.exports = { createForAssignedPatient, listForAssignedPatient, listOwn };
