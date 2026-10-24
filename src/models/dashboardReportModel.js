const db = require("../config/database");

const PATIENT_REPORT_COLUMNS = [
  "patients.id",
  "patients.user_id",
  "users.full_name",
  "patients.created_at",
];
const TREATMENT_PLAN_REPORT_COLUMNS = [
  "id",
  "patient_id",
  "doctor_id",
  "status",
  "created_at",
];

function treatmentPlanReportColumns(connection) {
  return [
    ...TREATMENT_PLAN_REPORT_COLUMNS.slice(0, 4),
    connection.raw("DATE_FORMAT(??, '%Y-%m-%d') AS ??", ["start_date", "start_date"]),
    connection.raw("DATE_FORMAT(??, '%Y-%m-%d') AS ??", ["end_date", "end_date"]),
    ...TREATMENT_PLAN_REPORT_COLUMNS.slice(4),
  ];
}
const ASSISTANCE_REQUEST_REPORT_COLUMNS = [
  "id",
  "patient_id",
  "doctor_id",
  "ngo_id",
  "status",
  "request_type",
  "created_at",
  "updated_at",
];

async function count(query, column = "id") {
  const row = await query.count({ count: column }).first();
  return Number(row.count);
}

async function getAdminDashboard(connection = db) {
  const [
    totalPatients,
    totalDoctors,
    totalNgos,
    pendingJoinRequests,
    activeEmergencyAlerts,
    pendingAssistanceRequests,
  ] = await Promise.all([
    count(
      connection("patients")
        .join("users", "users.id", "patients.user_id")
        .where("users.account_status", "ACTIVE"),
      "patients.id",
    ),
    count(
      connection("doctors")
        .join("users", "users.id", "doctors.user_id")
        .where("users.account_status", "ACTIVE"),
      "doctors.id",
    ),
    count(
      connection("ngos")
        .join("users", "users.id", "ngos.user_id")
        .where("users.account_status", "ACTIVE"),
      "ngos.id",
    ),
    count(connection("join_requests").where("status", "PENDING")),
    count(connection("emergency_alerts").whereNot("status", "RESOLVED")),
    count(connection("assistance_requests").where("status", "PENDING")),
  ]);

  return {
    total_patients: totalPatients,
    total_doctors: totalDoctors,
    total_ngos: totalNgos,
    pending_join_requests: pendingJoinRequests,
    active_emergency_alerts: activeEmergencyAlerts,
    pending_assistance_requests: pendingAssistanceRequests,
  };
}

async function getPatientDashboard(patientId, userId, connection = db) {
  const [
    activeTreatmentPlans,
    pendingReminders,
    activeEmergencyAlerts,
    pendingAssistanceRequests,
  ] = await Promise.all([
    count(
      connection("treatment_plans").where({
        patient_id: patientId,
        status: "ACTIVE",
      }),
    ),
    count(connection("reminders").where({ user_id: userId, status: "PENDING" })),
    count(
      connection("emergency_alerts")
        .where("patient_id", patientId)
        .whereNot("status", "RESOLVED"),
    ),
    count(
      connection("assistance_requests").where({
        patient_id: patientId,
        status: "PENDING",
      }),
    ),
  ]);

  return {
    active_treatment_plans: activeTreatmentPlans,
    pending_reminders: pendingReminders,
    active_emergency_alerts: activeEmergencyAlerts,
    pending_assistance_requests: pendingAssistanceRequests,
  };
}

async function getDoctorDashboard(doctorId, connection = db) {
  const [activePatientsRow, assignedEmergencyAlerts, submittedAssistanceRequests] =
    await Promise.all([
      connection("doctor_patient_assignments")
        .where({ doctor_id: doctorId, status: "ACTIVE" })
        .countDistinct({ count: "patient_id" })
        .first(),
      count(
        connection("emergency_alerts")
          .where("assigned_doctor_id", doctorId)
          .whereNot("status", "RESOLVED"),
      ),
      count(connection("assistance_requests").where("doctor_id", doctorId)),
    ]);

  return {
    active_patients: Number(activePatientsRow.count),
    assigned_emergency_alerts: assignedEmergencyAlerts,
    submitted_assistance_requests: submittedAssistanceRequests,
  };
}

async function getNgoDashboard(ngoId, connection = db) {
  const [assignedAssistanceRequests, resourceAllocations] = await Promise.all([
    count(connection("assistance_requests").where("ngo_id", ngoId)),
    count(
      connection("resource_allocations")
        .join(
          "assistance_requests",
          "assistance_requests.id",
          "resource_allocations.assistance_request_id",
        )
        .where("assistance_requests.ngo_id", ngoId),
      "resource_allocations.id",
    ),
  ]);

  return {
    assigned_assistance_requests: assignedAssistanceRequests,
    resource_allocations: resourceAllocations,
  };
}

async function listPaginated(
  query,
  countQuery,
  page,
  limit,
  createdAtColumn = "created_at",
  idColumn = "id",
) {
  const [items, countRow] = await Promise.all([
    query
      .orderBy(createdAtColumn, "desc")
      .orderBy(idColumn, "desc")
      .limit(limit)
      .offset((page - 1) * limit),
    countQuery.first(),
  ]);

  return { items, total: Number(countRow.total) };
}

function listPatients(page, limit, connection = db) {
  return listPaginated(
    connection("patients")
      .join("users", "users.id", "patients.user_id")
      .select(PATIENT_REPORT_COLUMNS),
    connection("patients").count({ total: "id" }),
    page,
    limit,
    "patients.created_at",
    "patients.id",
  );
}

function listTreatmentPlans(page, limit, connection = db) {
  return listPaginated(
    connection("treatment_plans").select(treatmentPlanReportColumns(connection)),
    connection("treatment_plans").count({ total: "id" }),
    page,
    limit,
  );
}

function listAssistanceRequests(filters, page, limit, connection = db) {
  const itemsQuery = connection("assistance_requests").select(
    ASSISTANCE_REQUEST_REPORT_COLUMNS,
  );
  const countQuery = connection("assistance_requests").count({ total: "id" });

  if (filters.status !== undefined) {
    itemsQuery.where("status", filters.status);
    countQuery.where("status", filters.status);
  }

  return listPaginated(itemsQuery, countQuery, page, limit);
}

module.exports = {
  getAdminDashboard,
  getDoctorDashboard,
  getNgoDashboard,
  getPatientDashboard,
  listAssistanceRequests,
  listPatients,
  listTreatmentPlans,
};
