const db = require("../config/database");

function buildCreatePayload(doctor) {
  return {
    user_id: doctor.user_id,
    specialization: doctor.specialization,
    license_number: doctor.license_number,
  };
}

function findById(id, connection = db) {
  return connection("doctors").where({ id }).first();
}

function findByIdForUpdate(id, connection) {
  return connection("doctors").where({ id }).forUpdate().first();
}

function findByUserId(userId, connection = db) {
  return connection("doctors").where({ user_id: userId }).first();
}

function findByLicenseNumber(licenseNumber, connection = db) {
  return connection("doctors").where({ license_number: licenseNumber }).first();
}

async function listActiveWithWorkload(connection = db) {
  const doctors = await connection("doctors")
    .join("users", "users.id", "doctors.user_id")
    .select(
      "doctors.id",
      "users.full_name",
      "users.email",
      "doctors.specialization",
      "doctors.availability",
      "doctors.capacity_limit",
      connection("doctor_patient_assignments")
        .count("id")
        .whereRaw("doctor_patient_assignments.doctor_id = doctors.id")
        .where("doctor_patient_assignments.status", "ACTIVE")
        .as("active_assignment_count"),
      connection("emergency_alerts")
        .count("id")
        .whereRaw("emergency_alerts.assigned_doctor_id = doctors.id")
        .whereIn("emergency_alerts.status", ["ASSIGNED", "IN_PROGRESS"])
        .as("open_emergency_alert_count"),
    )
    .where("users.role", "DOCTOR")
    .where("users.account_status", "ACTIVE")
    .orderBy("users.full_name", "asc");
  return doctors.map((doctor) => ({
    ...doctor,
    capacity_warning:
      doctor.capacity_limit !== null &&
      Number(doctor.active_assignment_count) >= Number(doctor.capacity_limit),
  }));
}

async function updateWorkload(id, updates, connection = db) {
  await connection("doctors").where({ id }).update({
    ...updates,
    updated_at: connection.fn.now(),
  });

  return findById(id, connection);
}

async function create(doctor, connection = db) {
  await connection("doctors").insert(buildCreatePayload(doctor));
  return findByUserId(doctor.user_id, connection);
}

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  findByUserId,
  findByLicenseNumber,
  listActiveWithWorkload,
  updateWorkload,
};
