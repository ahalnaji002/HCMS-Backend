const db = require("../config/database");

const ASSIGNMENT_COLUMNS = [
  "id",
  "doctor_id",
  "patient_id",
  "status",
  "assignment_reason",
  "notes",
  "assigned_at",
  "ended_at",
  "created_at",
  "updated_at",
];

function findById(id, connection = db) {
  return connection("doctor_patient_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .where({ id })
    .first();
}

function findByIdForUpdate(id, connection) {
  return connection("doctor_patient_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .where({ id })
    .forUpdate()
    .first();
}

function listAll(connection = db) {
  return connection("doctor_patient_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .orderBy("assigned_at", "desc")
    .orderBy("id", "desc");
}

function listActivePatientsByDoctorId(doctorId, connection = db) {
  return connection("doctor_patient_assignments as assignments")
    .join("patients", "patients.id", "assignments.patient_id")
    .join("users", "users.id", "patients.user_id")
    .select(
      "patients.id",
      "users.full_name",
      "users.email",
      "users.phone",
      "users.role",
      "users.account_status",
      "patients.date_of_birth",
      "patients.gender",
      "patients.address",
    )
    .where({
      "assignments.doctor_id": doctorId,
      "assignments.status": "ACTIVE",
    })
    .orderBy("users.full_name", "asc")
    .orderBy("patients.id", "asc");
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

async function updateStatus(id, status, endedAt, connection = db) {
  await connection("doctor_patient_assignments").where({ id }).update({
    status,
    ended_at: endedAt,
    updated_at: connection.fn.now(),
  });

  return findById(id, connection);
}

module.exports = {
  create,
  findActiveByDoctorAndPatient,
  findById,
  findByIdForUpdate,
  listActivePatientsByDoctorId,
  listAll,
  updateStatus,
};
