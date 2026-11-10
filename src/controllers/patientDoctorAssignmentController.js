const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const patientModel = require("../models/patientModel");

async function listOwn(req, res) {
  const patient = await patientModel.findByUserId(req.user.id);
  if (!patient) {
    return res.status(404).json({
      success: false,
      message: "Patient profile not found",
    });
  }

  const assignments = await doctorPatientAssignmentModel.listActiveForPatient(
    patient.id,
  );
  return res.status(200).json({
    success: true,
    message: "Patient doctor assignments retrieved successfully",
    data: { assignments },
  });
}

module.exports = { listOwn };
