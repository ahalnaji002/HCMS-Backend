const reminderService = require("../services/reminderService");

const REMINDER_INTERVAL_MS = 60 * 1000;
let reminderTimer = null;

async function runReminderDeliveryCycle() {
  try {
    return await reminderService.deliverDueReminders();
  } catch (error) {
    console.error("Reminder delivery cycle failed:", error);
    return [];
  }
}

function startReminderWorker() {
  if (process.env.NODE_ENV === "test" || reminderTimer) {
    return reminderTimer;
  }

  reminderTimer = setInterval(runReminderDeliveryCycle, REMINDER_INTERVAL_MS);
  reminderTimer.unref();
  return reminderTimer;
}

function stopReminderWorker() {
  if (!reminderTimer) {
    return;
  }

  clearInterval(reminderTimer);
  reminderTimer = null;
}

module.exports = {
  REMINDER_INTERVAL_MS,
  runReminderDeliveryCycle,
  startReminderWorker,
  stopReminderWorker,
};
