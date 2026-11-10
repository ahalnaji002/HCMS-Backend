const db = require("../config/database");

const TREATMENT_PLAN_COLUMNS = [
  "id",
  "patient_id",
  "doctor_id",
  "title",
  "general_instructions",
  "status",
  "created_at",
  "updated_at",
];

function selectColumns(connection) {
  return [
    ...TREATMENT_PLAN_COLUMNS.slice(0, 6),
    connection.raw("DATE_FORMAT(??, '%Y-%m-%d') AS ??", ["start_date", "start_date"]),
    connection.raw("DATE_FORMAT(??, '%Y-%m-%d') AS ??", ["end_date", "end_date"]),
    ...TREATMENT_PLAN_COLUMNS.slice(6),
  ];
}

async function create(treatmentPlan, connection = db) {
  const [id] = await connection("treatment_plans").insert({
    patient_id: treatmentPlan.patient_id,
    doctor_id: treatmentPlan.doctor_id,
    title: treatmentPlan.title,
    general_instructions: treatmentPlan.general_instructions ?? null,
    start_date: treatmentPlan.start_date,
    end_date: treatmentPlan.end_date ?? null,
  });

  return connection("treatment_plans")
    .select(selectColumns(connection))
    .where({ id })
    .first();
}

function listByPatientId(patientId, connection = db) {
  return connection("treatment_plans")
    .select(selectColumns(connection))
    .where({ patient_id: patientId })
    .orderBy("id", "asc");
}

function findById(planId, connection = db) {
  return connection("treatment_plans")
    .select(TREATMENT_PLAN_COLUMNS)
    .where({ id: planId })
    .first();
}

function findByIdForUpdate(planId, connection) {
  return connection("treatment_plans").select(selectColumns(connection)).where({ id: planId }).forUpdate().first();
}

function findByIdAndPatientId(planId, patientId, connection = db) {
  return connection("treatment_plans")
    .select(selectColumns(connection))
    .where({
      id: planId,
      patient_id: patientId,
    })
    .first();
}

function findByIdAndPatientIdForUpdate(planId, patientId, connection) {
  return connection("treatment_plans")
    .select(selectColumns(connection))
    .where({ id: planId, patient_id: patientId })
    .forUpdate()
    .first();
}

async function updateByIdAndPatientId(
  planId,
  patientId,
  treatmentPlanData,
  connection = db,
) {
  await connection("treatment_plans")
    .where({
      id: planId,
      patient_id: patientId,
    })
    .update({
      ...treatmentPlanData,
      updated_at: connection.fn.now(),
    });

  return findByIdAndPatientId(planId, patientId, connection);
}

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  listByPatientId,
  findByIdAndPatientId,
  findByIdAndPatientIdForUpdate,
  updateByIdAndPatientId,
};
