exports.up = function (knex) {
  return knex.schema.createTable("treatment_appointments", (table) => {
    table.bigIncrements("id");
    table.bigInteger("treatment_plan_id").unsigned().notNullable();
    table.dateTime("appointment_date").notNullable();
    table.string("purpose", 255).notNullable();
    table.string("location", 255).nullable().defaultTo(null);
    table
      .enu("status", ["SCHEDULED", "COMPLETED", "CANCELLED"])
      .notNullable()
      .defaultTo("SCHEDULED");
    table.text("notes").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("treatment_plan_id").references("id").inTable("treatment_plans");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("treatment_appointments");
};
