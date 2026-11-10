const app = require("./app");
const db = require("./config/database");
const { startReminderWorker } = require("./workers/reminderWorker");

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.raw("SELECT 1 AS connected");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.code || error.message);
    await db.destroy().catch(() => {});
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startReminderWorker();
  });
}

start();
