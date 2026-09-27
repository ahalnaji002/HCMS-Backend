const reminderService = require("../services/reminderService");

function handleReminderError(error, res) {
  if (error instanceof reminderService.ReminderNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error instanceof reminderService.ReminderForbiddenError) {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (error instanceof reminderService.ReminderConflictError) {
    return res.status(409).json({ success: false, message: error.message });
  }

  console.error("Reminder error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function create(req, res) {
  try {
    const reminder = await reminderService.createOwnReminder(
      req.user,
      req.validatedReminder,
    );

    return res.status(201).json({
      success: true,
      message: "Reminder created successfully",
      data: { reminder },
    });
  } catch (error) {
    return handleReminderError(error, res);
  }
}

async function list(req, res) {
  try {
    const reminders = await reminderService.listOwnReminders(req.user);

    return res.status(200).json({
      success: true,
      message: "Reminders retrieved successfully",
      data: { reminders },
    });
  } catch (error) {
    return handleReminderError(error, res);
  }
}

async function get(req, res) {
  try {
    const reminder = await reminderService.getOwnReminder(
      req.user,
      req.validatedReminderId,
    );

    return res.status(200).json({
      success: true,
      message: "Reminder retrieved successfully",
      data: { reminder },
    });
  } catch (error) {
    return handleReminderError(error, res);
  }
}

async function cancel(req, res) {
  try {
    const reminder = await reminderService.cancelOwnReminder(
      req.user,
      req.validatedReminderId,
    );

    return res.status(200).json({
      success: true,
      message: "Reminder cancelled successfully",
      data: { reminder },
    });
  } catch (error) {
    return handleReminderError(error, res);
  }
}

module.exports = {
  cancel,
  create,
  get,
  list,
};
