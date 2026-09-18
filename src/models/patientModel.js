const db = require("../config/database");

function buildCreatePayload(patient) {
  const payload = {
    user_id: patient.user_id,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
  };

  if (patient.address !== undefined) {
    payload.address = patient.address;
  }

  return payload;
}

function findByUserId(userId, connection = db) {
  return connection("patients").where({ user_id: userId }).first();
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
  findByUserId,
  updateProfile,
};
