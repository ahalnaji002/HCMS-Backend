const db = require("../config/database");

const ACTIVITY_LOG_COLUMNS = [
  "id",
  "user_id",
  "action",
  "entity_type",
  "entity_id",
  "description",
  "ip_address",
  "created_at",
];

async function create(activityLog, connection) {
  const [id] = await connection("activity_logs").insert({
    user_id: activityLog.user_id,
    action: activityLog.action,
    entity_type: activityLog.entity_type,
    entity_id: activityLog.entity_id,
    description: activityLog.description,
    ip_address: activityLog.ip_address,
  });

  return findById(id, connection);
}

function findById(logId, connection = db) {
  return connection("activity_logs")
    .select(ACTIVITY_LOG_COLUMNS)
    .where({ id: logId })
    .first();
}

function applyFilters(query, filters) {
  if (filters.user_id !== undefined) {
    query.where("user_id", filters.user_id);
  }
  if (filters.action !== undefined) {
    query.where("action", filters.action);
  }
  if (filters.entity_type !== undefined) {
    query.where("entity_type", filters.entity_type);
  }
  if (filters.entity_id !== undefined) {
    query.where("entity_id", filters.entity_id);
  }
  if (filters.date_from !== undefined) {
    query.where("created_at", ">=", filters.date_from);
  }
  if (filters.date_to !== undefined) {
    query.where("created_at", "<=", filters.date_to);
  }

  return query;
}

async function listPaginated(filters, page, limit, connection = db) {
  const itemsQuery = applyFilters(
    connection("activity_logs").select(ACTIVITY_LOG_COLUMNS),
    filters,
  );
  const countQuery = applyFilters(
    connection("activity_logs").count({ total: "id" }),
    filters,
  );

  const [items, countRow] = await Promise.all([
    itemsQuery
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(limit)
      .offset((page - 1) * limit),
    countQuery.first(),
  ]);

  return {
    items,
    total: Number(countRow.total),
  };
}

module.exports = {
  ACTIVITY_LOG_COLUMNS,
  create,
  findById,
  listPaginated,
};
