exports.up = function (knex) {
  return knex.schema.createTable("emergency_alerts", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable();
    table.bigInteger("assigned_doctor_id").unsigned().nullable().defaultTo(null);
    table.bigInteger("assigned_by_admin_id").unsigned().nullable().defaultTo(null);
    table.text("description").notNullable();
    table.enu("priority", ["HIGH", "CRITICAL"]).notNullable().defaultTo("HIGH");
    table
      .enu(
        "status",
        ["NEW", "PENDING_ASSIGNMENT", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]
      )
      .notNullable()
      .defaultTo("NEW");
    table.timestamp("sent_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("assigned_at").nullable().defaultTo(null);
    table.timestamp("responded_at").nullable().defaultTo(null);
    table.timestamp("resolved_at").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
    table.foreign("assigned_doctor_id").references("id").inTable("doctors");
    table.foreign("assigned_by_admin_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("emergency_alerts");
};
