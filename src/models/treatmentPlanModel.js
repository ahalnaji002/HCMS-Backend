const db = require("../config/database");

const TREATMENT_PLAN_COLUMNS = [
  "id",
  "patient_id",
  "doctor_id",
  "title",
  "general_instructions",
  "status",
  "start_date",
  "end_date",
  "created_at",
  "updated_at",
];

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
    .select(TREATMENT_PLAN_COLUMNS)
    .where({ id })
    .first();
}

function listByPatientId(patientId, connection = db) {
  return connection("treatment_plans")
    .select(TREATMENT_PLAN_COLUMNS)
    .where({ patient_id: patientId })
    .orderBy("id", "asc");
}

function findByIdAndPatientId(planId, patientId, connection = db) {
  return connection("treatment_plans")
    .select(TREATMENT_PLAN_COLUMNS)
    .where({
      id: planId,
      patient_id: patientId,
    })
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
  listByPatientId,
  findByIdAndPatientId,
  updateByIdAndPatientId,
};
