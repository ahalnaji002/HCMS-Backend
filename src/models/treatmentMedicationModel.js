const db = require("../config/database");

const TREATMENT_MEDICATION_COLUMNS = [
  "id",
  "treatment_plan_id",
  "medication_name",
  "dosage",
  "frequency",
  "duration",
  "instructions",
  "created_at",
  "updated_at",
];

async function create(medication, connection = db) {
  const [id] = await connection("treatment_medications").insert({
    treatment_plan_id: medication.treatment_plan_id,
    medication_name: medication.medication_name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    duration: medication.duration ?? null,
    instructions: medication.instructions ?? null,
  });

  return findByIdAndPlanId(id, medication.treatment_plan_id, connection);
}

function listByPlanId(planId, connection = db) {
  return connection("treatment_medications")
    .select(TREATMENT_MEDICATION_COLUMNS)
    .where({ treatment_plan_id: planId })
    .orderBy("id", "asc");
}

function findByIdAndPlanId(medicationId, planId, connection = db) {
  return connection("treatment_medications")
    .select(TREATMENT_MEDICATION_COLUMNS)
    .where({
      id: medicationId,
      treatment_plan_id: planId,
    })
    .first();
}

async function updateByIdAndPlanId(
  medicationId,
  planId,
  updates,
  connection = db,
) {
  await connection("treatment_medications")
    .where({
      id: medicationId,
      treatment_plan_id: planId,
    })
    .update({
      ...updates,
      updated_at: connection.fn.now(),
    });

  return findByIdAndPlanId(medicationId, planId, connection);
}

function deleteByIdAndPlanId(medicationId, planId, connection = db) {
  return connection("treatment_medications")
    .where({
      id: medicationId,
      treatment_plan_id: planId,
    })
    .del();
}

module.exports = {
  create,
  deleteByIdAndPlanId,
  findByIdAndPlanId,
  listByPlanId,
  updateByIdAndPlanId,
};
