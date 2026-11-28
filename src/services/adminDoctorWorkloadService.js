const doctorModel = require("../models/doctorModel");
const userModel = require("../models/userModel");
const { NotFoundError } = require("../utils/apiErrors");
const db = require("../config/database");
const { recordActorEvent } = require("./activityLogService");

class DoctorWorkloadNotFoundError extends NotFoundError {
  constructor() {
    super("Active Doctor not found");
    this.name = "DoctorWorkloadNotFoundError";
  }
}

async function listActiveDoctors() {
  return doctorModel.listActiveWithWorkload();
}

async function updateDoctorWorkload(doctorId, updates, actor = null) {
  const doctor = await doctorModel.findById(doctorId);
  if (!doctor) throw new DoctorWorkloadNotFoundError();

  const user = await userModel.findById(doctor.user_id);
  if (!user || user.role !== "DOCTOR" || user.account_status !== "ACTIVE") {
    throw new DoctorWorkloadNotFoundError();
  }

  return db.transaction(async (trx) => {
    const updated = await doctorModel.updateWorkload(doctor.id, updates, trx);
    await recordActorEvent(actor, "UPDATE_DOCTOR_WORKLOAD", doctor.id, trx);
    return updated;
  });
}

module.exports = {
  DoctorWorkloadNotFoundError,
  listActiveDoctors,
  updateDoctorWorkload,
};
