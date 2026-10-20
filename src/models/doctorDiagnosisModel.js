const db = require("../config/database");

const DIAGNOSIS_COLUMNS = [
  "doctor_diagnoses.id",
  "doctor_diagnoses.patient_id",
  "doctor_diagnoses.doctor_id",
  "doctor_diagnoses.diagnosis",
  "doctor_diagnoses.documented_at",
  "users.full_name as doctor_name",
  "doctors.specialization",
];

function query(connection = db) {
  return connection("doctor_diagnoses")
    .join("doctors", "doctors.id", "doctor_diagnoses.doctor_id")
    .join("users", "users.id", "doctors.user_id");
}

async function create(diagnosis, connection = db) {
  const [id] = await connection("doctor_diagnoses").insert({
    patient_id: diagnosis.patient_id,
    doctor_id: diagnosis.doctor_id,
    diagnosis: diagnosis.diagnosis,
  });

  return query(connection)
    .select(DIAGNOSIS_COLUMNS)
    .where("doctor_diagnoses.id", id)
    .first();
}

function listByPatientId(patientId, connection = db) {
  return query(connection)
    .select(DIAGNOSIS_COLUMNS)
    .where("doctor_diagnoses.patient_id", patientId)
    .orderBy("doctor_diagnoses.documented_at", "desc")
    .orderBy("doctor_diagnoses.id", "desc");
}

module.exports = { create, listByPatientId };
