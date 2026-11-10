const treatmentAppointmentService = require("../services/treatmentAppointmentService");

async function create(req, res) {
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
}

async function listForDoctor(req, res) {
  const appointments = await treatmentAppointmentService.listForDoctor(
    req.user,
    req.params.planId,
  );
  return res.status(200).json({
    success: true,
    message: "Treatment Appointments retrieved successfully",
    data: { appointments },
  });
}

async function getForDoctor(req, res) {
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
}

async function updateForDoctor(req, res) {
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
}

async function deleteForDoctor(req, res) {
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
}

async function listForPatient(req, res) {
  const appointments = await treatmentAppointmentService.listForPatient(
    req.user,
    req.params.planId,
  );
  return res.status(200).json({
    success: true,
    message: "Treatment Appointments retrieved successfully",
    data: { appointments },
  });
}

async function getForPatient(req, res) {
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
