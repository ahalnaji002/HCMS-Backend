const medicalNoteService = require("../services/medicalNoteService");

function handleMedicalNoteError(error, res) {
  if (error instanceof medicalNoteService.MedicalNoteNotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof medicalNoteService.MedicalNoteForbiddenError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Medical Note error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createForAssignedPatient(req, res) {
  try {
    const medicalNote = await medicalNoteService.createForAssignedPatient(
      req.user,
      req.validatedPatientId,
      req.validatedMedicalNote,
    );

    return res.status(201).json({
      success: true,
      message: "Medical Note created successfully",
      data: {
        medical_note: medicalNote,
      },
    });
  } catch (error) {
    return handleMedicalNoteError(error, res);
  }
}

async function listForAssignedPatient(req, res) {
  try {
    const medicalNotes = await medicalNoteService.listForAssignedPatient(
      req.user,
      req.validatedPatientId,
    );

    return res.status(200).json({
      success: true,
      message: "Medical Notes retrieved successfully",
      data: {
        medical_notes: medicalNotes,
      },
    });
  } catch (error) {
    return handleMedicalNoteError(error, res);
  }
}

module.exports = {
  createForAssignedPatient,
  listForAssignedPatient,
};
