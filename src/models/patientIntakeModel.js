const db = require("../config/database");

const INTAKE_FIELDS = [
  "current_problem",
  "symptoms",
  "symptom_onset",
  "chronic_conditions_answer",
  "chronic_conditions_details",
  "medications_answer",
  "medications_details",
  "allergies_answer",
  "allergies_details",
  "additional_information",
];

function findByPatientId(patientId, connection = db) {
  return connection("patient_intakes").where({ patient_id: patientId }).first();
}

function findByPatientIdForUpdate(patientId, connection) {
  return connection("patient_intakes")
    .where({ patient_id: patientId })
    .forUpdate()
    .first();
}

function findByIdForUpdate(id, connection) {
  return connection("patient_intakes").where({ id }).forUpdate().first();
}

function listForAdmin(connection = db) {
  return connection("patient_intakes")
    .join("patients", "patients.id", "patient_intakes.patient_id")
    .join("users", "users.id", "patients.user_id")
    .select(
      "patient_intakes.*",
      "users.full_name as patient_name",
      "users.email as patient_email",
    )
    .orderBy("patient_intakes.submitted_at", "asc")
    .orderBy("patient_intakes.id", "asc");
}

async function create(patientId, intake, connection = db) {
  const payload = Object.fromEntries(
    INTAKE_FIELDS.map((field) => [field, intake[field] ?? null]),
  );
  payload.patient_id = patientId;
  payload.status = "SUBMITTED";

  const [id] = await connection("patient_intakes").insert(payload);
  return connection("patient_intakes").where({ id }).first();
}

async function update(id, intake, connection = db) {
  const payload = Object.fromEntries(
    INTAKE_FIELDS.map((field) => [field, intake[field] ?? null]),
  );
  payload.updated_at = connection.fn.now();

  await connection("patient_intakes").where({ id }).update(payload);
  return connection("patient_intakes").where({ id }).first();
}

async function startReview(id, adminUserId, connection = db) {
  await connection("patient_intakes").where({ id }).update({
    status: "UNDER_REVIEW",
    review_started_at: connection.fn.now(),
    review_started_by_admin_id: adminUserId,
    updated_at: connection.fn.now(),
  });

  return connection("patient_intakes").where({ id }).first();
}

async function markDoctorAssigned(patientId, connection = db) {
  await connection("patient_intakes").where({ patient_id: patientId }).update({
    status: "DOCTOR_ASSIGNED",
    updated_at: connection.fn.now(),
  });

  return findByPatientId(patientId, connection);
}

module.exports = {
  create,
  findByIdForUpdate,
  findByPatientId,
  findByPatientIdForUpdate,
  listForAdmin,
  markDoctorAssigned,
  startReview,
  update,
};
