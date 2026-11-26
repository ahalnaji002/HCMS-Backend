const db = require("../config/database");

const PUBLIC_USER_COLUMNS = [
  "id",
  "full_name",
  "email",
  "role",
  "account_status",
  "phone",
  "created_at",
  "updated_at",
];

const AUTHENTICATION_USER_COLUMNS = [...PUBLIC_USER_COLUMNS, "password_hash"];

function buildCreatePayload(user) {
  const payload = {
    full_name: user.full_name,
    email: user.email,
    password_hash: user.password_hash,
    role: user.role,
  };

  if (user.account_status !== undefined) {
    payload.account_status = user.account_status;
  }

  if (user.phone !== undefined) {
    payload.phone = user.phone;
  }

  return payload;
}

function findById(id, connection = db) {
  return connection("users").select(PUBLIC_USER_COLUMNS).where({ id }).first();
}

function findByEmail(email, connection = db) {
  return connection("users")
    .select(PUBLIC_USER_COLUMNS)
    .where({ email })
    .first();
}

function findByEmailWithPasswordHash(email, connection = db) {
  return connection("users")
    .select(AUTHENTICATION_USER_COLUMNS)
    .where({ email })
    .first();
}

async function create(user, connection = db) {
  const [id] = await connection("users").insert(buildCreatePayload(user));
  return findById(id, connection);
}

async function updateAccountStatus(id, accountStatus, connection = db) {
  await connection("users")
    .where({ id })
    .update({
      account_status: accountStatus,
      updated_at: connection.fn.now(),
    });

  return findById(id, connection);
}

function findRoleAndAccountStatus(id, connection = db) {
  return connection("users")
    .select(["id", "role", "account_status"])
    .where({ id })
    .first();
}

async function updateProfile(id, updates, connection = db) {
  await connection("users")
    .where({ id })
    .update({
      ...updates,
      updated_at: connection.fn.now(),
    });

  return findById(id, connection);
}

function findByIdForUpdate(id, connection) {
  return connection("users")
    .select(PUBLIC_USER_COLUMNS)
    .where({ id })
    .forUpdate()
    .first();
}

// Escapes LIKE wildcards so a search for "50%" matches the literal text.
function likePattern(search) {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function applyAdminFilters(query, filters) {
  if (filters.role) query.where("role", filters.role);
  if (filters.account_status) query.where("account_status", filters.account_status);
  if (filters.search) {
    const pattern = likePattern(filters.search);
    query.where((builder) => {
      builder
        .where("full_name", "like", pattern)
        .orWhere("email", "like", pattern)
        .orWhere("phone", "like", pattern);
    });
  }
  return query;
}

async function listForAdmin(filters, page, limit, connection = db) {
  const [items, countRow] = await Promise.all([
    applyAdminFilters(connection("users").select(PUBLIC_USER_COLUMNS), filters)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(limit)
      .offset((page - 1) * limit),
    applyAdminFilters(connection("users").count({ total: "id" }), filters).first(),
  ]);

  return { items, total: Number(countRow.total) };
}

// Locks every active administrator row so two concurrent deactivations
// cannot both pass the "last active administrator" check.
async function countActiveAdminsForUpdate(connection) {
  const rows = await connection("users")
    .select("id")
    .where({ role: "ADMIN", account_status: "ACTIVE" })
    .orderBy("id", "asc")
    .forUpdate();
  return rows.length;
}

module.exports = {
  listForAdmin,
  countActiveAdminsForUpdate,
  findById,
  findByEmail,
  findByEmailWithPasswordHash,
  create,
  updateAccountStatus,
  findRoleAndAccountStatus,
  updateProfile,
  findByIdForUpdate,
};
