const db = require("../config/database");

const SYSTEM_SETTING_COLUMNS = [
  "id",
  "setting_key",
  "setting_value",
  "description",
  "updated_at",
];

function listByKeys(settingKeys, connection = db) {
  return connection("system_settings")
    .select(SYSTEM_SETTING_COLUMNS)
    .whereIn("setting_key", settingKeys)
    .orderBy("setting_key", "asc");
}

function findById(settingId, connection = db) {
  return connection("system_settings")
    .select(SYSTEM_SETTING_COLUMNS)
    .where({ id: settingId })
    .first();
}

function findByKey(settingKey, connection = db) {
  return connection("system_settings")
    .select(SYSTEM_SETTING_COLUMNS)
    .where({ setting_key: settingKey })
    .first();
}

function findByKeyForUpdate(settingKey, connection) {
  return connection("system_settings")
    .select(SYSTEM_SETTING_COLUMNS)
    .where({ setting_key: settingKey })
    .forUpdate()
    .first();
}

async function updateValue(
  settingId,
  settingValue,
  adminUserId,
  connection,
) {
  await connection("system_settings").where({ id: settingId }).update({
    setting_value: settingValue,
    updated_by_admin_id: adminUserId,
    updated_at: connection.fn.now(),
  });

  return findById(settingId, connection);
}

module.exports = {
  SYSTEM_SETTING_COLUMNS,
  findById,
  findByKey,
  findByKeyForUpdate,
  listByKeys,
  updateValue,
};
