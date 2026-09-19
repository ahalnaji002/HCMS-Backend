const {
  ActiveAssignmentExistsError,
  AssignmentNotFoundError,
  AssignmentStatusConflictError,
  DoctorNotActiveError,
  DoctorNotFoundError,
  PatientNotActiveError,
  PatientNotFoundError,
  createDoctorPatientAssignment,
  getDoctorPatientAssignment,
  listDoctorPatientAssignments,
  updateDoctorPatientAssignmentStatus,
} = require("../services/doctorPatientAssignmentService");

function assignmentErrorResponse(error, res) {
  if (
    error instanceof AssignmentNotFoundError ||
    error instanceof DoctorNotFoundError ||
    error instanceof PatientNotFoundError
  ) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error instanceof DoctorNotActiveError ||
    error instanceof PatientNotActiveError ||
    error instanceof ActiveAssignmentExistsError ||
    error instanceof AssignmentStatusConflictError
  ) {
    return res.status(409).json({
      success: false,
      message: error.message,
    });
  }

  return undefined;
}

async function updateStatus(req, res) {
  try {
    const assignment = await updateDoctorPatientAssignmentStatus(
      req.validatedAssignmentId,
      req.validatedAssignmentStatus,
    );

    return res.status(200).json({
      success: true,
      message: "Doctor-patient assignment status updated successfully",
      data: { assignment },
    });
  } catch (error) {
    return (
      assignmentErrorResponse(error, res) ||
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    );
  }
}

async function list(req, res) {
  try {
    const assignments = await listDoctorPatientAssignments();

    return res.status(200).json({
      success: true,
      message: "Doctor-patient assignments retrieved successfully",
      data: { assignments },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function show(req, res) {
  try {
    const assignment = await getDoctorPatientAssignment(
      req.validatedAssignmentId,
    );

    return res.status(200).json({
      success: true,
      message: "Doctor-patient assignment retrieved successfully",
      data: { assignment },
    });
  } catch (error) {
    return (
      assignmentErrorResponse(error, res) ||
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    );
  }
}

async function create(req, res) {
  try {
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
  } catch (error) {
    return (
      assignmentErrorResponse(error, res) ||
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    );
  }
}

module.exports = {
  create,
  list,
  show,
  updateStatus,
};
