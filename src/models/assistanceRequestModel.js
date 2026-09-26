const db = require("../config/database");

const ASSISTANCE_REQUEST_COLUMNS = [
  "id",
  "patient_id",
  "doctor_id",
  "ngo_id",
  "request_type",
  "description",
  "status",
  "submitted_at",
  "reviewed_at",
  "created_at",
  "updated_at",
];

function findByIdAndPatientId(requestId, patientId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({
      id: requestId,
      patient_id: patientId,
    })
    .first();
}

function listByPatientId(patientId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({ patient_id: patientId })
    .orderBy("submitted_at", "desc")
    .orderBy("id", "desc");
}

async function create(request, connection = db) {
  const [id] = await connection("assistance_requests").insert({
    patient_id: request.patient_id,
    doctor_id: request.doctor_id,
    ngo_id: null,
    request_type: request.request_type,
    description: request.description,
    status: "PENDING",
  });

  return findByIdAndPatientId(id, request.patient_id, connection);
}

module.exports = {
  create,
  findByIdAndPatientId,
  listByPatientId,
};
