const db = require("../config/database");

const DETAIL_COLUMNS = [
  "join_requests.id",
  "join_requests.user_id",
  "join_requests.request_type",
  "join_requests.status",
  "join_requests.reviewed_by_admin_id",
  "join_requests.reviewed_at",
  "join_requests.rejection_reason",
  "join_requests.created_at",
  "join_requests.updated_at",
  "users.full_name as user_full_name",
  "users.email as user_email",
  "users.role as user_role",
  "users.account_status as user_account_status",
  "users.phone as user_phone",
  "doctors.specialization as doctor_specialization",
  "doctors.license_number as doctor_license_number",
  "ngos.organization_name as ngo_organization_name",
  "ngos.registration_number as ngo_registration_number",
  "ngos.address as ngo_address",
  "ngos.contact_phone as ngo_contact_phone",
];

function detailQuery(connection = db) {
  return connection("join_requests")
    .leftJoin("users", "join_requests.user_id", "users.id")
    .leftJoin("doctors", "join_requests.user_id", "doctors.user_id")
    .leftJoin("ngos", "join_requests.user_id", "ngos.user_id")
    .select(DETAIL_COLUMNS);
}

function findById(id, connection = db) {
  return connection("join_requests").where({ id }).first();
}

function findByIdForUpdate(id, connection) {
  return connection("join_requests").where({ id }).forUpdate().first();
}

function findDetailedById(id, connection = db) {
  return detailQuery(connection).where("join_requests.id", id).first();
}

function findPendingByUserId(userId, connection = db) {
  return connection("join_requests")
    .where({ user_id: userId, status: "PENDING" })
    .first();
}

function findLatestApplicantStatusByUserId(userId, connection = db) {
  return connection("join_requests")
    .select([
      "request_type",
      "status",
      "rejection_reason",
      "created_at",
      "reviewed_at",
    ])
    .where({ user_id: userId })
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .first();
}

function listPendingDetailed(connection = db) {
  return detailQuery(connection)
    .where("join_requests.status", "PENDING")
    .orderBy("join_requests.created_at", "asc");
}

async function create(joinRequest, connection = db) {
  const [id] = await connection("join_requests").insert({
    user_id: joinRequest.user_id,
    request_type: joinRequest.request_type,
  });

  return findById(id, connection);
}

async function updateReview(id, review, connection = db) {
  const updates = {};

  if (review.status !== undefined) updates.status = review.status;
  if (review.reviewed_by_admin_id !== undefined) {
    updates.reviewed_by_admin_id = review.reviewed_by_admin_id;
  }
  if (review.reviewed_at !== undefined) updates.reviewed_at = review.reviewed_at;
  if (review.rejection_reason !== undefined) {
    updates.rejection_reason = review.rejection_reason;
  }

  if (Object.keys(updates).length > 0) {
    await connection("join_requests")
      .where({ id })
      .update({
        ...updates,
        updated_at: connection.fn.now(),
      });
  }

  return findById(id, connection);
}

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  findDetailedById,
  findLatestApplicantStatusByUserId,
  findPendingByUserId,
  listPendingDetailed,
  updateReview,
};
