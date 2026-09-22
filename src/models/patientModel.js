const db = require("../config/database");

function buildCreatePayload(patient) {
  const payload = {
    user_id: patient.user_id,
    national_id: patient.national_id,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
  };

  if (patient.address !== undefined) {
    payload.address = patient.address;
  }

  return payload;
}

function findById(id, connection = db) {
  return connection("patients").where({ id }).first();
}

function findByIdForUpdate(id, connection) {
  return connection("patients").where({ id }).forUpdate().first();
}

function findByUserId(userId, connection = db) {
  return connection("patients").where({ user_id: userId }).first();
}

function findProfileById(id, connection = db) {
  return connection("patients")
    .join("users", "users.id", "patients.user_id")
    .select(
      "patients.id",
      "users.full_name",
      "users.email",
      "users.phone",
      "users.role",
      "users.account_status",
      "patients.date_of_birth",
      "patients.gender",
      "patients.address",
    )
    .where("patients.id", id)
    .first();
}

async function create(patient, connection = db) {
  await connection("patients").insert(buildCreatePayload(patient));
  return findByUserId(patient.user_id, connection);
}

async function updateProfile(userId, updates, connection = db) {
  await connection("patients")
    .where({ user_id: userId })
    .update({
      ...updates,
      updated_at: connection.fn.now(),
    });

  return findByUserId(userId, connection);
}

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  findProfileById,
  findByNationalId(nationalId, connection = db) {
    return connection("patients").where({ national_id: nationalId }).first();
  },
  findByUserId,
  updateProfile,
};
