const db = require("../config/database");

const ASSISTANCE_REQUEST_COLUMNS = [
  "id",
  "patient_id",
  "doctor_id",
  "ngo_id",
  "request_type",
  "description",
  "status",
  "submitted_at",
  "reviewed_at",
  "created_at",
  "updated_at",
];

function findByIdAndPatientId(requestId, patientId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({
      id: requestId,
      patient_id: patientId,
    })
    .first();
}

function listByPatientId(patientId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({ patient_id: patientId })
    .orderBy("submitted_at", "desc")
    .orderBy("id", "desc");
}

function listAll(connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .orderBy("submitted_at", "desc")
    .orderBy("id", "desc");
}

function findById(requestId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({ id: requestId })
    .first();
}

function findByIdForUpdate(requestId, connection) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({ id: requestId })
    .forUpdate()
    .first();
}

function listByNgoId(ngoId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({ ngo_id: ngoId })
    .orderBy("submitted_at", "desc")
    .orderBy("id", "desc");
}

function findByIdAndNgoId(requestId, ngoId, connection = db) {
  return connection("assistance_requests")
    .select(ASSISTANCE_REQUEST_COLUMNS)
    .where({ id: requestId, ngo_id: ngoId })
    .first();
}

async function assignPendingToNgo(
  requestId,
  ngoId,
  connection = db,
) {
  const affectedRows = await connection("assistance_requests")
    .where({ id: requestId, status: "PENDING" })
    .whereNull("ngo_id")
    .update({
      ngo_id: ngoId,
      updated_at: connection.fn.now(),
    });

  if (affectedRows === 0) {
    return null;
  }

  return findById(requestId, connection);
}

async function updateStatusConditionally(
  requestId,
  ngoId,
  currentStatus,
  nextStatus,
  connection = db,
) {
  const updates = {
    status: nextStatus,
    updated_at: connection.fn.now(),
  };

  if (nextStatus === "APPROVED" || nextStatus === "REJECTED") {
    updates.reviewed_at = connection.fn.now();
  }

  const affectedRows = await connection("assistance_requests")
    .where({
      id: requestId,
      ngo_id: ngoId,
      status: currentStatus,
    })
    .update(updates);

  if (affectedRows === 0) {
    return null;
  }

  return findByIdAndNgoId(requestId, ngoId, connection);
}

async function hasResourceAllocation(requestId, connection = db) {
  const allocation = await connection("resource_allocations")
    .select("id")
    .where({ assistance_request_id: requestId })
    .forUpdate()
    .first();

  return Boolean(allocation);
}

async function create(request, connection = db) {
  const [id] = await connection("assistance_requests").insert({
    patient_id: request.patient_id,
    doctor_id: request.doctor_id,
    ngo_id: null,
    request_type: request.request_type,
    description: request.description,
    status: "PENDING",
  });

  return findByIdAndPatientId(id, request.patient_id, connection);
}

module.exports = {
  assignPendingToNgo,
  create,
  findById,
  findByIdAndNgoId,
  findByIdAndPatientId,
  findByIdForUpdate,
  hasResourceAllocation,
  listAll,
  listByNgoId,
  listByPatientId,
  updateStatusConditionally,
};
