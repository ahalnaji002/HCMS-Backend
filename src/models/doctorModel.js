const db = require("../config/database");

function buildCreatePayload(doctor) {
  return {
    user_id: doctor.user_id,
    specialization: doctor.specialization,
    license_number: doctor.license_number,
  };
}

function findByUserId(userId, connection = db) {
  return connection("doctors").where({ user_id: userId }).first();
}

function findByLicenseNumber(licenseNumber, connection = db) {
  return connection("doctors")
    .where({ license_number: licenseNumber })
    .first();
}

async function create(doctor, connection = db) {
  await connection("doctors").insert(buildCreatePayload(doctor));
  return findByUserId(doctor.user_id, connection);
}

module.exports = {
  create,
  findByUserId,
  findByLicenseNumber,
};
