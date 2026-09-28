const db = require("../config/database");

const TREATMENT_APPOINTMENT_COLUMNS = [
  "id",
  "treatment_plan_id",
  "appointment_date",
  "purpose",
  "location",
  "status",
  "notes",
  "created_at",
  "updated_at",
];

async function create(appointment, connection = db) {
  const [id] = await connection("treatment_appointments").insert({
    treatment_plan_id: appointment.treatment_plan_id,
    appointment_date: appointment.appointment_date,
    purpose: appointment.purpose,
    location: appointment.location ?? null,
    notes: appointment.notes ?? null,
  });

  return findByIdAndPlanId(id, appointment.treatment_plan_id, connection);
}

function listByPlanId(planId, connection = db) {
  return connection("treatment_appointments")
    .select(TREATMENT_APPOINTMENT_COLUMNS)
    .where({ treatment_plan_id: planId })
    .orderBy("id", "asc");
}

function findById(appointmentId, connection = db) {
  return connection("treatment_appointments")
    .select(TREATMENT_APPOINTMENT_COLUMNS)
    .where({ id: appointmentId })
    .first();
}

function findByIdAndPlanId(appointmentId, planId, connection = db) {
  return connection("treatment_appointments")
    .select(TREATMENT_APPOINTMENT_COLUMNS)
    .where({ id: appointmentId, treatment_plan_id: planId })
    .first();
}

async function updateByIdAndPlanId(
  appointmentId,
  planId,
  updates,
  connection = db,
) {
  await connection("treatment_appointments")
    .where({ id: appointmentId, treatment_plan_id: planId })
    .update({ ...updates, updated_at: connection.fn.now() });

  return findByIdAndPlanId(appointmentId, planId, connection);
}

function deleteByIdAndPlanId(appointmentId, planId, connection = db) {
  return connection("treatment_appointments")
    .where({ id: appointmentId, treatment_plan_id: planId })
    .del();
}

module.exports = {
  create,
  deleteByIdAndPlanId,
  findById,
  findByIdAndPlanId,
  listByPlanId,
  updateByIdAndPlanId,
};
