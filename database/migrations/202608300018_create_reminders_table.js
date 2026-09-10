exports.up = function (knex) {
  return knex.schema.createTable("reminders", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().notNullable();
    table.enu("type", ["MEDICATION", "APPOINTMENT"]).notNullable();
    table.string("reference_type", 50).notNullable();
    table.bigInteger("reference_id").unsigned().notNullable();
    table.dateTime("remind_at").notNullable();
    table
      .enu("status", ["PENDING", "SENT", "CANCELLED"])
      .notNullable()
      .defaultTo("PENDING");
    table.timestamp("sent_at").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("reminders");
};
