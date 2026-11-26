const db = require("../config/database");

function buildCreatePayload(ngo) {
  const payload = {
    user_id: ngo.user_id,
    organization_name: ngo.organization_name,
  };

  if (ngo.registration_number !== undefined) {
    payload.registration_number = ngo.registration_number;
  }

  if (ngo.address !== undefined) {
    payload.address = ngo.address;
  }

  if (ngo.contact_phone !== undefined) {
    payload.contact_phone = ngo.contact_phone;
  }

  return payload;
}

function findByUserId(userId, connection = db) {
  return connection("ngos").where({ user_id: userId }).first();
}

function findById(id, connection = db) {
  return connection("ngos").where({ id }).first();
}

function findByIdForUpdate(id, connection) {
  return connection("ngos").where({ id }).forUpdate().first();
}

function findByRegistrationNumber(registrationNumber, connection = db) {
  return connection("ngos")
    .where({ registration_number: registrationNumber })
    .first();
}

async function create(ngo, connection = db) {
  await connection("ngos").insert(buildCreatePayload(ngo));
  return findByUserId(ngo.user_id, connection);
}

const OPEN_REQUEST_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED"];

// Administrator view (FR-10.2): every NGO with its account status and the
// Assistance Requests assigned to it, counted in one grouped subquery.
function listForAdmin(filters = {}, connection = db) {
  const requestCounts = connection("assistance_requests")
    .select("ngo_id")
    .count({ assigned_requests: "id" })
    .select(
      connection.raw(
        `SUM(CASE WHEN status IN (${OPEN_REQUEST_STATUSES.map(() => "?").join(", ")}) THEN 1 ELSE 0 END) AS open_requests`,
        OPEN_REQUEST_STATUSES,
      ),
      connection.raw("SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_requests"),
    )
    .whereNotNull("ngo_id")
    .groupBy("ngo_id")
    .as("request_counts");

  const query = connection("ngos")
    .join("users", "users.id", "ngos.user_id")
    .leftJoin(requestCounts, "request_counts.ngo_id", "ngos.id")
    .select(
      "ngos.id",
      "ngos.user_id",
      "ngos.organization_name",
      "ngos.registration_number",
      "ngos.address",
      "ngos.contact_phone",
      "ngos.created_at",
      "users.full_name",
      "users.email",
      "users.phone",
      "users.account_status",
      connection.raw("COALESCE(request_counts.assigned_requests, 0) AS assigned_requests"),
      connection.raw("COALESCE(request_counts.open_requests, 0) AS open_requests"),
      connection.raw("COALESCE(request_counts.completed_requests, 0) AS completed_requests"),
    )
    .orderBy("ngos.organization_name", "asc")
    .orderBy("ngos.id", "asc");

  if (filters.account_status) query.where("users.account_status", filters.account_status);
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    query.where((builder) => {
      builder
        .where("ngos.organization_name", "like", pattern)
        .orWhere("ngos.registration_number", "like", pattern)
        .orWhere("users.email", "like", pattern);
    });
  }

  return query.then((rows) => rows.map((row) => ({
    ...row,
    assigned_requests: Number(row.assigned_requests),
    open_requests: Number(row.open_requests),
    completed_requests: Number(row.completed_requests),
  })));
}

module.exports = {
  listForAdmin,
  create,
  findById,
  findByIdForUpdate,
  findByRegistrationNumber,
  findByUserId,
};
