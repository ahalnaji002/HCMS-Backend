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

module.exports = {
  create,
  findById,
  findByIdForUpdate,
  findByRegistrationNumber,
  findByUserId,
};
