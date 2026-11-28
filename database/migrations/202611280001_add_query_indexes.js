// Indexes for columns that lists, counters, and the reminder worker filter on.
// Foreign keys already index their first column; these cover the status
// filters and the "per user, newest first" lists that would otherwise scan.

const INDEXES = [
  // Reminder worker: WHERE status = 'PENDING' AND remind_at <= now, every minute.
  { table: "reminders", columns: ["status", "remind_at"], name: "reminders_status_remind_at_index" },
  // Unread counter and "mark all read".
  { table: "notifications", columns: ["user_id", "is_read"], name: "notifications_user_id_is_read_index" },
  // A user's notification list, newest first.
  { table: "notifications", columns: ["user_id", "created_at"], name: "notifications_user_id_created_at_index" },
  // Conversation history and the per-participant summary.
  { table: "messages", columns: ["sender_id", "receiver_id", "sent_at"], name: "messages_sender_receiver_sent_at_index" },
  { table: "messages", columns: ["receiver_id", "sender_id", "sent_at"], name: "messages_receiver_sender_sent_at_index" },
  { table: "emergency_alerts", columns: ["status"], name: "emergency_alerts_status_index" },
  { table: "assistance_requests", columns: ["status"], name: "assistance_requests_status_index" },
  { table: "activity_logs", columns: ["created_at"], name: "activity_logs_created_at_index" },
  { table: "users", columns: ["role", "account_status"], name: "users_role_account_status_index" },
];

// When a new index starts with a foreign key column, MySQL drops the
// foreign key's own single-column index as redundant. Before the composite
// index can be dropped again, that single-column index has to come back.
const FOREIGN_KEY_INDEXES = {
  notifications: [{ columns: ["user_id"], name: "notifications_user_id_foreign" }],
  messages: [
    { columns: ["sender_id"], name: "messages_sender_id_foreign" },
    { columns: ["receiver_id"], name: "messages_receiver_id_foreign" },
  ],
};

async function indexNames(knex, table) {
  const [rows] = await knex.raw("SHOW INDEX FROM ??", [table]);
  return new Set(rows.map((row) => row.Key_name));
}

exports.up = async function (knex) {
  for (const { table, columns, name } of INDEXES) {
    if ((await indexNames(knex, table)).has(name)) continue;
    await knex.schema.alterTable(table, (builder) => {
      builder.index(columns, name);
    });
  }
};

exports.down = async function (knex) {
  for (const [table, indexes] of Object.entries(FOREIGN_KEY_INDEXES)) {
    const present = await indexNames(knex, table);
    for (const { columns, name } of indexes) {
      if (present.has(name)) continue;
      await knex.schema.alterTable(table, (builder) => {
        builder.index(columns, name);
      });
    }
  }

  for (const { table, columns, name } of [...INDEXES].reverse()) {
    if (!(await indexNames(knex, table)).has(name)) continue;
    await knex.schema.alterTable(table, (builder) => {
      builder.dropIndex(columns, name);
    });
  }
};
