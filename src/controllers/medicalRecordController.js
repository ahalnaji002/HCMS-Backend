const medicalRecordService = require("../services/medicalRecordService");

function handleMedicalRecordError(error, res) {
  if (error instanceof medicalRecordService.MedicalRecordNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof medicalRecordService.MedicalRecordForbiddenError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof medicalRecordService.MedicalRecordConflictError) {
    return res.status(409).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Medical Record error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createForAssignedPatient(req, res) {
  try {
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
  } catch (error) {
    return handleMedicalRecordError(error, res);
  }
}

async function getForAssignedPatient(req, res) {
  try {
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
  } catch (error) {
    return handleMedicalRecordError(error, res);
  }
}

async function updateForAssignedPatient(req, res) {
  try {
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
  } catch (error) {
    return handleMedicalRecordError(error, res);
  }
}

async function getOwnMedicalRecord(req, res) {
  try {
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
  } catch (error) {
    return handleMedicalRecordError(error, res);
  }
}

module.exports = {
  createForAssignedPatient,
  getForAssignedPatient,
  getOwnMedicalRecord,
  updateForAssignedPatient,
};
