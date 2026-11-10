const medicalNoteService = require("../services/medicalNoteService");

async function createForAssignedPatient(req, res) {
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
}

async function listForAssignedPatient(req, res) {
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
}

module.exports = {
  createForAssignedPatient,
  listForAssignedPatient,
};
