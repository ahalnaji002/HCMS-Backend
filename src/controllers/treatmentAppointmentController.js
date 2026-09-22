const treatmentAppointmentService = require("../services/treatmentAppointmentService");

function handleTreatmentAppointmentError(error, res) {
  if (
    error instanceof
    treatmentAppointmentService.TreatmentAppointmentValidationError
  ) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.errors,
    });
  }

  if (
    error instanceof treatmentAppointmentService.TreatmentAppointmentForbiddenError
  ) {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (
    error instanceof treatmentAppointmentService.TreatmentAppointmentNotFoundError
  ) {
    return res.status(404).json({ success: false, message: error.message });
  }

  console.error("Treatment Appointment error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function create(req, res) {
  try {
    const appointment = await treatmentAppointmentService.createForPlan(
      req.user,
      req.params.planId,
      req.validatedTreatmentAppointment,
    );

    return res.status(201).json({
      success: true,
      message: "Treatment Appointment created successfully",
      data: { appointment },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

async function listForDoctor(req, res) {
  try {
    const appointments = await treatmentAppointmentService.listForDoctor(
      req.user,
      req.params.planId,
    );
    return res.status(200).json({
      success: true,
      message: "Treatment Appointments retrieved successfully",
      data: { appointments },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

async function getForDoctor(req, res) {
  try {
    const appointment = await treatmentAppointmentService.getForDoctor(
      req.user,
      req.params.planId,
      req.params.appointmentId,
    );
    return res.status(200).json({
      success: true,
      message: "Treatment Appointment retrieved successfully",
      data: { appointment },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

async function updateForDoctor(req, res) {
  try {
    const appointment = await treatmentAppointmentService.updateForDoctor(
      req.user,
      req.params.planId,
      req.params.appointmentId,
      req.validatedTreatmentAppointment,
    );
    return res.status(200).json({
      success: true,
      message: "Treatment Appointment updated successfully",
      data: { appointment },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

async function deleteForDoctor(req, res) {
  try {
    const appointment = await treatmentAppointmentService.deleteForDoctor(
      req.user,
      req.params.planId,
      req.params.appointmentId,
    );
    return res.status(200).json({
      success: true,
      message: "Treatment Appointment deleted successfully",
      data: { appointment },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

async function listForPatient(req, res) {
  try {
    const appointments = await treatmentAppointmentService.listForPatient(
      req.user,
      req.params.planId,
    );
    return res.status(200).json({
      success: true,
      message: "Treatment Appointments retrieved successfully",
      data: { appointments },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

async function getForPatient(req, res) {
  try {
    const appointment = await treatmentAppointmentService.getForPatient(
      req.user,
      req.params.planId,
      req.params.appointmentId,
    );
    return res.status(200).json({
      success: true,
      message: "Treatment Appointment retrieved successfully",
      data: { appointment },
    });
  } catch (error) {
    return handleTreatmentAppointmentError(error, res);
  }
}

module.exports = {
  create,
  deleteForDoctor,
  getForDoctor,
  getForPatient,
  listForDoctor,
  listForPatient,
  updateForDoctor,
};
