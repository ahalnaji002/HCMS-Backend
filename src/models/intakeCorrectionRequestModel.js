const db = require("../config/database");

const REQUEST_COLUMNS = [
  "intake_correction_requests.id",
  "intake_correction_requests.patient_id",
  "intake_correction_requests.message",
  "intake_correction_requests.status",
  "intake_correction_requests.admin_response",
  "intake_correction_requests.resolved_by_admin_id",
  "intake_correction_requests.resolved_at",
  "intake_correction_requests.created_at",
  "intake_correction_requests.updated_at",
];

async function create(patientId, message, connection = db) {
  const [id] = await connection("intake_correction_requests").insert({
    patient_id: patientId,
    message,
  });

  return connection("intake_correction_requests")
    .select(REQUEST_COLUMNS)
    .where({ id })
    .first();
}

function listByPatientId(patientId, connection = db) {
  return connection("intake_correction_requests")
    .select(REQUEST_COLUMNS)
    .where({ patient_id: patientId })
    .orderBy("created_at", "desc")
    .orderBy("id", "desc");
}

function listForAdmin(connection = db) {
  return connection("intake_correction_requests")
    .join("patients", "patients.id", "intake_correction_requests.patient_id")
    .join("users", "users.id", "patients.user_id")
    .select(
      ...REQUEST_COLUMNS,
      "users.full_name as patient_name",
      "users.email as patient_email",
    )
    .orderBy("intake_correction_requests.created_at", "asc")
    .orderBy("intake_correction_requests.id", "asc");
}

function findByIdForUpdate(id, connection) {
  return connection("intake_correction_requests")
    .select(REQUEST_COLUMNS)
    .where({ id })
    .forUpdate()
    .first();
}

async function resolve(id, adminUserId, adminResponse, connection = db) {
  await connection("intake_correction_requests").where({ id }).update({
    status: "RESOLVED",
    admin_response: adminResponse,
    resolved_by_admin_id: adminUserId,
    resolved_at: connection.fn.now(),
    updated_at: connection.fn.now(),
  });

  return connection("intake_correction_requests")
    .select(REQUEST_COLUMNS)
    .where({ id })
    .first();
}

module.exports = {
  create,
  findByIdForUpdate,
  listByPatientId,
  listForAdmin,
  resolve,
};
