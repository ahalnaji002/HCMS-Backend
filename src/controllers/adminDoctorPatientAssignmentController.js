const {
  createDoctorPatientAssignment,
  getDoctorPatientAssignment,
  listDoctorPatientAssignments,
  updateDoctorPatientAssignmentStatus,
} = require("../services/doctorPatientAssignmentService");

async function updateStatus(req, res) {
  const assignment = await updateDoctorPatientAssignmentStatus(
    req.validatedAssignmentId,
    req.validatedAssignmentStatus,
  );

  return res.status(200).json({
    success: true,
    message: "Doctor-patient assignment status updated successfully",
    data: { assignment },
  });
}

async function list(req, res) {
  const assignments = await listDoctorPatientAssignments();

  return res.status(200).json({
    success: true,
    message: "Doctor-patient assignments retrieved successfully",
    data: { assignments },
  });
}

async function show(req, res) {
  const assignment = await getDoctorPatientAssignment(
    req.validatedAssignmentId,
  );

  return res.status(200).json({
    success: true,
    message: "Doctor-patient assignment retrieved successfully",
    data: { assignment },
  });
}

async function create(req, res) {
  const assignment = await createDoctorPatientAssignment(
    req.validatedAssignment,
  );

  return res.status(201).json({
    success: true,
    message: "Doctor-patient assignment created successfully",
    data: {
      assignment,
    },
  });
}

module.exports = {
  create,
  list,
  show,
  updateStatus,
};
