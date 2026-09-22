const db = require("../config/database");

const MEDICAL_NOTE_COLUMNS = [
  "id",
  "medical_record_id",
  "doctor_id",
  "note",
  "created_at",
  "updated_at",
];

async function create(medicalNote, connection = db) {
  const [id] = await connection("medical_notes").insert({
    medical_record_id: medicalNote.medical_record_id,
    doctor_id: medicalNote.doctor_id,
    note: medicalNote.note,
  });

  return connection("medical_notes")
    .select(MEDICAL_NOTE_COLUMNS)
    .where({ id })
    .first();
}

function listByMedicalRecordAndDoctor(
  medicalRecordId,
  doctorId,
  connection = db,
) {
  return connection("medical_notes")
    .select(MEDICAL_NOTE_COLUMNS)
    .where({
      medical_record_id: medicalRecordId,
      doctor_id: doctorId,
    })
    .orderBy("id", "asc");
}

module.exports = {
  create,
  listByMedicalRecordAndDoctor,
};
