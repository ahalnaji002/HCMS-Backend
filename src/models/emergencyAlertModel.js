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

function listAll(connection = db) {
  return connection("emergency_alerts")
    .select(EMERGENCY_ALERT_COLUMNS)
    .orderBy("sent_at", "desc")
    .orderBy("id", "desc");
}

function findById(alertId, connection = db) {
  return connection("emergency_alerts")
    .select(EMERGENCY_ALERT_COLUMNS)
    .where({ id: alertId })
    .first();
}

// Doctor view: alert columns plus the registered Patient's name and account
// phone. Visitor alerts (patient_id NULL) keep both fields NULL.
function doctorViewQuery(doctorId, connection) {
  return connection("emergency_alerts")
    .leftJoin("patients", "patients.id", "emergency_alerts.patient_id")
    .leftJoin("users as patient_users", "patient_users.id", "patients.user_id")
    .select(
      ...EMERGENCY_ALERT_COLUMNS.map((column) => `emergency_alerts.${column}`),
      "patient_users.full_name as patient_name",
      "patient_users.phone as patient_phone",
    )
    .where("emergency_alerts.assigned_doctor_id", doctorId);
}

function listByAssignedDoctorId(doctorId, connection = db) {
  return doctorViewQuery(doctorId, connection)
    .orderBy("emergency_alerts.sent_at", "desc")
    .orderBy("emergency_alerts.id", "desc");
}

function findByIdAndAssignedDoctorId(alertId, doctorId, connection = db) {
  return doctorViewQuery(doctorId, connection)
    .where("emergency_alerts.id", alertId)
    .first();
}

function findByIdForUpdate(alertId, connection) {
  return connection("emergency_alerts")
    .select(EMERGENCY_ALERT_COLUMNS)
    .where({ id: alertId })
    .forUpdate()
    .first();
}

async function assignPendingToDoctor(
  alertId,
  doctorId,
  adminUserId,
  connection = db,
) {
  const affectedRows = await connection("emergency_alerts")
    .where({
      id: alertId,
      status: "PENDING_ASSIGNMENT",
    })
    .update({
      assigned_doctor_id: doctorId,
      assigned_by_admin_id: adminUserId,
      assigned_at: connection.fn.now(),
      status: "ASSIGNED",
      updated_at: connection.fn.now(),
    });

  if (affectedRows === 0) {
    return null;
  }

  return findById(alertId, connection);
}

async function transitionAssignedDoctorStatus(
  alertId,
  doctorId,
  currentStatus,
  nextStatus,
  connection = db,
) {
  const updates = {
    status: nextStatus,
    updated_at: connection.fn.now(),
  };

  if (nextStatus === "IN_PROGRESS") {
    updates.responded_at = connection.fn.now();
  }

  if (nextStatus === "RESOLVED") {
    updates.resolved_at = connection.fn.now();
  }

  const affectedRows = await connection("emergency_alerts")
    .where({
      id: alertId,
      assigned_doctor_id: doctorId,
      status: currentStatus,
    })
    .update(updates);

  if (affectedRows === 0) {
    return null;
  }

  return findById(alertId, connection);
}

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  findByIdAndPatientId,
  listAll,
  listByPatientId,
  listByAssignedDoctorId,
  findByIdAndAssignedDoctorId,
  cancelPendingByIdAndPatientId,
  assignPendingToDoctor,
  transitionAssignedDoctorStatus,
};
