const db = require("../config/database");

const EMERGENCY_ALERT_COLUMNS = [
  "id",
  "patient_id",
  "phone",
  "location",
  "assigned_doctor_id",
  "assigned_by_admin_id",
  "description",
  "priority",
  "status",
  "sent_at",
  "assigned_at",
  "responded_at",
  "resolved_at",
  "created_at",
  "updated_at",
];

async function create(emergencyAlert, connection = db) {
  const [id] = await connection("emergency_alerts").insert({
    patient_id: emergencyAlert.patient_id ?? null,
    phone: emergencyAlert.phone,
    location: emergencyAlert.location ?? null,
    description: emergencyAlert.description ?? null,
    priority: emergencyAlert.priority,
    status: emergencyAlert.status,
  });

  return connection("emergency_alerts")
    .select(EMERGENCY_ALERT_COLUMNS)
    .where({ id })
    .first();
}

function listByPatientId(patientId, connection = db) {
  return connection("emergency_alerts")
    .select(EMERGENCY_ALERT_COLUMNS)
    .where({ patient_id: patientId })
    .orderBy("sent_at", "desc")
    .orderBy("id", "desc");
}

function findByIdAndPatientId(alertId, patientId, connection = db) {
  return connection("emergency_alerts")
    .select(EMERGENCY_ALERT_COLUMNS)
    .where({ id: alertId, patient_id: patientId })
    .first();
}

async function cancelPendingByIdAndPatientId(
  alertId,
  patientId,
  connection = db,
) {
  const affectedRows = await connection("emergency_alerts")
    .where({
      id: alertId,
      patient_id: patientId,
      status: "PENDING_ASSIGNMENT",
    })
    .update({
      status: "CANCELLED",
      updated_at: connection.fn.now(),
    });

  if (affectedRows === 0) {
    return null;
  }

  return findByIdAndPatientId(alertId, patientId, connection);
}

module.exports = {
  create,
  findByIdAndPatientId,
  listByPatientId,
  cancelPendingByIdAndPatientId,
};
