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
  return connection("users").select(PUBLIC_USER_COLUMNS).where({ email }).first();
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
    .update({ account_status: accountStatus });

  return findById(id, connection);
}

function findRoleAndAccountStatus(id, connection = db) {
  return connection("users")
    .select(["id", "role", "account_status"])
    .where({ id })
    .first();
}

module.exports = {
  findById,
  findByEmail,
  findByEmailWithPasswordHash,
  create,
  updateAccountStatus,
  findRoleAndAccountStatus,
};
