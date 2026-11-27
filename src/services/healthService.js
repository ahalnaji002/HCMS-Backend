const db = require("../config/database");

async function checkDatabase() {
  await db.raw("SELECT 1");
}

module.exports = {
  checkDatabase,
};
