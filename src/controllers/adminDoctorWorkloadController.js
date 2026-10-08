const adminDoctorWorkloadService = require("../services/adminDoctorWorkloadService");

function handleError(error, res) {
  if (error instanceof adminDoctorWorkloadService.DoctorWorkloadNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }
  console.error("Doctor workload error:", error);
  return res.status(500).json({ success: false, message: "Internal server error" });
}

async function listActive(req, res) {
  try {
    const doctors = await adminDoctorWorkloadService.listActiveDoctors();
    return res.status(200).json({
      success: true,
      message: "Active Doctors retrieved successfully",
      data: { doctors },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

async function updateWorkload(req, res) {
  try {
    const doctor = await adminDoctorWorkloadService.updateDoctorWorkload(
      req.validatedDoctorId,
      req.validatedDoctorWorkload,
    );
    return res.status(200).json({
      success: true,
      message: "Doctor availability and capacity updated successfully",
      data: { doctor },
    });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = { listActive, updateWorkload };
