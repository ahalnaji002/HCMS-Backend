require("dotenv").config({ quiet: true });

const { assertValidEnvironment } = require("./config/validateEnvironment");

try {
  assertValidEnvironment();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = require("./app");
const db = require("./config/database");
const { startReminderWorker, stopReminderWorker } = require("./workers/reminderWorker");

const PORT = process.env.PORT || 3000;
// Hosts give a few seconds between SIGTERM and SIGKILL; stop before that.
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

let server = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  const forceExit = setTimeout(() => {
    console.error("Shutdown timed out, exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  stopReminderWorker();

  try {
    if (server) {
      // Stop accepting connections and let in-flight requests finish.
      await new Promise((resolve) => server.close(resolve));
    }
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error("Shutdown failed:", error.code || error.message);
    process.exit(1);
  }
}

async function start() {
  try {
    await db.raw("SELECT 1 AS connected");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error.code || error.message);
    await db.destroy().catch(() => {});
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startReminderWorker();
  });

  server.on("error", async (error) => {
    console.error("Server failed to start:", error.code || error.message);
    await db.destroy().catch(() => {});
    process.exit(1);
  });

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
