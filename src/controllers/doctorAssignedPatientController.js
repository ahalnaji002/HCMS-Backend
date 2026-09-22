const doctorAssignedPatientService = require("../services/doctorAssignedPatientService");
const formatDateOnly = require("../utils/formatDateOnly");

function formatPatient(patient) {
  return {
    ...patient,
    date_of_birth: formatDateOnly(patient.date_of_birth),
  };
}

function handleError(error, res) {
  if (
    error instanceof
    doctorAssignedPatientService.DoctorAssignedPatientNotFoundError
  ) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error instanceof
    doctorAssignedPatientService.DoctorAssignedPatientForbiddenError
  ) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Doctor assigned-patient error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function list(req, res) {
  try {
    const patients = await doctorAssignedPatientService.listAssignedPatients(
      req.user,
    );

    return res.status(200).json({
      success: true,
      message: "Assigned Patients retrieved successfully",
      data: {
        patients: patients.map(formatPatient),
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function show(req, res) {
  try {
    const patient = await doctorAssignedPatientService.getAssignedPatient(
      req.user,
      req.validatedPatientId,
    );

    return res.status(200).json({
      success: true,
      message: "Assigned Patient retrieved successfully",
      data: {
        patient: formatPatient(patient),
      },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  list,
  show,
};
