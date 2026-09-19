const db = require("../config/database");

function findById(id, connection = db) {
  return connection("doctor_patient_assignments").where({ id }).first();
}

function findActiveByDoctorAndPatient(doctorId, patientId, connection = db) {
  return connection("doctor_patient_assignments")
    .where({
      doctor_id: doctorId,
      patient_id: patientId,
      status: "ACTIVE",
    })
    .first();
}

async function create(assignment, connection = db) {
  const payload = {
    doctor_id: assignment.doctor_id,
    patient_id: assignment.patient_id,
    status: "ACTIVE",
  };

  if (assignment.assignment_reason !== undefined) {
    payload.assignment_reason = assignment.assignment_reason;
  }

  if (assignment.notes !== undefined) {
    payload.notes = assignment.notes;
  }

  const [id] = await connection("doctor_patient_assignments").insert(payload);

  return findById(id, connection);
}

module.exports = {
  create,
  findActiveByDoctorAndPatient,
  findById,
};
