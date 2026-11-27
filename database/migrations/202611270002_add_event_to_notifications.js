// Notifications carry English title/message text. The frontend needs a stable
// event name (and the new status, when the event is a status change) to show
// the notification in the reader's language. Existing rows are back-filled
// from their title and message, which were produced by fixed templates.

const TITLE_TO_EVENT = {
  "Emergency Alert assigned": "EMERGENCY_ALERT_ASSIGNED",
  "Emergency Alert status updated": "EMERGENCY_ALERT_STATUS_CHANGED",
  "Treatment Plan updated": "TREATMENT_PLAN_UPDATED",
  "Assistance Request status updated": "ASSISTANCE_REQUEST_STATUS_CHANGED",
  "Reminder due": "REMINDER_DUE",
};

const STATUS_PATTERN = / is now ([A-Z_]+)\.$/;

exports.up = async function (knex) {
  await knex.schema.alterTable("notifications", (table) => {
    table.string("event", 50).nullable().defaultTo(null).after("type");
    table.string("event_status", 30).nullable().defaultTo(null).after("event");
  });

  for (const [title, event] of Object.entries(TITLE_TO_EVENT)) {
    await knex("notifications").where({ title }).update({ event });
  }

  const statusRows = await knex("notifications")
    .select("id", "message")
    .whereIn("event", [
      "EMERGENCY_ALERT_STATUS_CHANGED",
      "ASSISTANCE_REQUEST_STATUS_CHANGED",
    ]);

  for (const row of statusRows) {
    const match = STATUS_PATTERN.exec(row.message);

    if (match) {
      await knex("notifications")
        .where({ id: row.id })
        .update({ event_status: match[1] });
    }
  }
};

exports.down = function (knex) {
  return knex.schema.alterTable("notifications", (table) => {
    table.dropColumn("event_status");
    table.dropColumn("event");
  });
};
