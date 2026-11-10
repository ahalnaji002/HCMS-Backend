const medicalRecordService = require("../services/medicalRecordService");

async function createForAssignedPatient(req, res) {
  const medicalRecord = await medicalRecordService.createForAssignedPatient(
    req.user,
    req.validatedPatientId,
    req.validatedMedicalRecord,
  );

  return res.status(201).json({
    success: true,
    message: "Medical Record created successfully",
    data: {
      medical_record: medicalRecord,
    },
  });
}

async function getForAssignedPatient(req, res) {
  const medicalRecord = await medicalRecordService.getForAssignedPatient(
    req.user,
    req.validatedPatientId,
  );

  return res.status(200).json({
    success: true,
    message: "Medical Record retrieved successfully",
    data: {
      medical_record: medicalRecord,
    },
  });
}

async function updateForAssignedPatient(req, res) {
  const medicalRecord = await medicalRecordService.updateForAssignedPatient(
    req.user,
    req.validatedPatientId,
    req.validatedMedicalRecordUpdate,
  );

  return res.status(200).json({
    success: true,
    message: "Medical Record updated successfully",
    data: {
      medical_record: medicalRecord,
    },
  });
}

async function getOwnMedicalRecord(req, res) {
  const medicalRecord = await medicalRecordService.getOwnMedicalRecord(
    req.user,
  );

  return res.status(200).json({
    success: true,
    message: "Medical Record retrieved successfully",
    data: {
      medical_record: medicalRecord,
    },
  });
}

module.exports = {
  createForAssignedPatient,
  getForAssignedPatient,
  getOwnMedicalRecord,
  updateForAssignedPatient,
};
