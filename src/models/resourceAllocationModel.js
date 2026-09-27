const db = require("../config/database");

const RESOURCE_ALLOCATION_COLUMNS = [
  "id",
  "assistance_request_id",
  "resource_name",
  "quantity",
  "delivery_date",
  "notes",
  "created_at",
  "updated_at",
];

async function create(allocation, connection = db) {
  const [id] = await connection("resource_allocations").insert({
    assistance_request_id: allocation.assistance_request_id,
    resource_name: allocation.resource_name,
    quantity: allocation.quantity,
    delivery_date: allocation.delivery_date ?? null,
    notes: allocation.notes ?? null,
  });

  return findByIdAndRequestId(id, allocation.assistance_request_id, connection);
}

function listByRequestId(requestId, connection = db) {
  return connection("resource_allocations")
    .select(RESOURCE_ALLOCATION_COLUMNS)
    .where({ assistance_request_id: requestId })
    .orderBy("created_at", "asc")
    .orderBy("id", "asc");
}

function findByIdAndRequestId(resourceId, requestId, connection = db) {
  return connection("resource_allocations")
    .select(RESOURCE_ALLOCATION_COLUMNS)
    .where({ id: resourceId, assistance_request_id: requestId })
    .first();
}

function findById(resourceId, connection = db) {
  return connection("resource_allocations")
    .select(RESOURCE_ALLOCATION_COLUMNS)
    .where({ id: resourceId })
    .first();
}

function findByIdForUpdate(resourceId, connection) {
  return connection("resource_allocations")
    .select(RESOURCE_ALLOCATION_COLUMNS)
    .where({ id: resourceId })
    .forUpdate()
    .first();
}

async function updateByIdAndRequestId(
  resourceId,
  requestId,
  updates,
  connection = db,
) {
  const affectedRows = await connection("resource_allocations")
    .where({ id: resourceId, assistance_request_id: requestId })
    .update({
      ...updates,
      updated_at: connection.fn.now(),
    });

  if (affectedRows === 0) {
    return null;
  }

  return findByIdAndRequestId(resourceId, requestId, connection);
}

function deleteByIdAndRequestId(
  resourceId,
  requestId,
  connection = db,
) {
  return connection("resource_allocations")
    .where({ id: resourceId, assistance_request_id: requestId })
    .del();
}

module.exports = {
  create,
  deleteByIdAndRequestId,
  findById,
  findByIdAndRequestId,
  findByIdForUpdate,
  listByRequestId,
  updateByIdAndRequestId,
};
