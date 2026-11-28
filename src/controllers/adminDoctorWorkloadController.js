const adminDoctorWorkloadService = require("../services/adminDoctorWorkloadService");
const requestActor = require("../utils/requestActor");

async function listActive(req, res) {
  const doctors = await adminDoctorWorkloadService.listActiveDoctors();
  return res.status(200).json({
    success: true,
    message: "Active Doctors retrieved successfully",
    data: { doctors },
  });
}

async function updateWorkload(req, res) {
  const doctor = await adminDoctorWorkloadService.updateDoctorWorkload(
    req.validatedDoctorId,
    req.validatedDoctorWorkload,
    requestActor(req),
  );
  return res.status(200).json({
    success: true,
    message: "Doctor availability and capacity updated successfully",
    data: { doctor },
  });
}

module.exports = { listActive, updateWorkload };
