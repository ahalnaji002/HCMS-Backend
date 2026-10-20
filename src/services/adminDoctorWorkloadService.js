const doctorModel = require("../models/doctorModel");
const userModel = require("../models/userModel");

class DoctorWorkloadNotFoundError extends Error {
  constructor() {
    super("Active Doctor not found");
    this.name = "DoctorWorkloadNotFoundError";
  }
}

async function listActiveDoctors() {
  return doctorModel.listActiveWithWorkload();
}

async function updateDoctorWorkload(doctorId, updates) {
  const doctor = await doctorModel.findById(doctorId);
  if (!doctor) throw new DoctorWorkloadNotFoundError();

  const user = await userModel.findById(doctor.user_id);
  if (!user || user.role !== "DOCTOR" || user.account_status !== "ACTIVE") {
    throw new DoctorWorkloadNotFoundError();
  }

  return doctorModel.updateWorkload(doctor.id, updates);
}

module.exports = {
  DoctorWorkloadNotFoundError,
  listActiveDoctors,
  updateDoctorWorkload,
};
