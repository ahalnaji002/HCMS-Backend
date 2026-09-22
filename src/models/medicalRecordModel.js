const db = require("../config/database");

const MEDICAL_RECORD_COLUMNS = [
  "id",
  "patient_id",
  "blood_type",
  "allergies",
  "chronic_diseases",
  "medical_history",
  "previous_surgeries",
  "created_at",
  "updated_at",
];

function findByPatientId(patientId, connection = db) {
  return connection("medical_records")
    .select(MEDICAL_RECORD_COLUMNS)
    .where({ patient_id: patientId })
    .first();
}

async function create(medicalRecord, connection = db) {
  const payload = {
    patient_id: medicalRecord.patient_id,
  };

  const editableFields = [
    "blood_type",
    "allergies",
    "chronic_diseases",
    "medical_history",
    "previous_surgeries",
  ];

  for (const field of editableFields) {
    if (medicalRecord[field] !== undefined) {
      payload[field] = medicalRecord[field];
    }
  }

  const [id] = await connection("medical_records").insert(payload);

  return connection("medical_records")
    .select(MEDICAL_RECORD_COLUMNS)
    .where({ id })
    .first();
}

async function updateByPatientId(patientId, updates, connection = db) {
  await connection("medical_records")
    .where({ patient_id: patientId })
    .update({
      ...updates,
      updated_at: connection.fn.now(),
    });

  return findByPatientId(patientId, connection);
}

module.exports = {
  create,
  findByPatientId,
  updateByPatientId,
};
