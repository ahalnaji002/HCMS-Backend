const doctorAssignedPatientService = require("../services/doctorAssignedPatientService");
const formatDateOnly = require("../utils/formatDateOnly");

function formatPatient(patient) {
  return {
    ...patient,
    date_of_birth: formatDateOnly(patient.date_of_birth),
  };
}

async function list(req, res) {
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
}

async function show(req, res) {
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
}

module.exports = {
  list,
  show,
};
