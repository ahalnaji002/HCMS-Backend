const {
  ActiveAssignmentExistsError,
  DoctorNotActiveError,
  DoctorNotFoundError,
  PatientNotActiveError,
  PatientNotFoundError,
  createDoctorPatientAssignment,
} = require("../services/doctorPatientAssignmentService");

function assignmentErrorResponse(error, res) {
  if (
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
    error instanceof ActiveAssignmentExistsError
  ) {
    return res.status(409).json({
      success: false,
      message: error.message,
    });
  }

  return undefined;
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
};
