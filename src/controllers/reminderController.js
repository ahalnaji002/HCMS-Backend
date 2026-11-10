const reminderService = require("../services/reminderService");

async function create(req, res) {
  const reminder = await reminderService.createOwnReminder(
    req.user,
    req.validatedReminder,
  );

  return res.status(201).json({
    success: true,
    message: "Reminder created successfully",
    data: { reminder },
  });
}

async function list(req, res) {
  const reminders = await reminderService.listOwnReminders(req.user);

  return res.status(200).json({
    success: true,
    message: "Reminders retrieved successfully",
    data: { reminders },
  });
}

async function get(req, res) {
  const reminder = await reminderService.getOwnReminder(
    req.user,
    req.validatedReminderId,
  );

  return res.status(200).json({
    success: true,
    message: "Reminder retrieved successfully",
    data: { reminder },
  });
}

async function cancel(req, res) {
  const reminder = await reminderService.cancelOwnReminder(
    req.user,
    req.validatedReminderId,
  );

  return res.status(200).json({
    success: true,
    message: "Reminder cancelled successfully",
    data: { reminder },
  });
}

module.exports = {
  cancel,
  create,
  get,
  list,
};
