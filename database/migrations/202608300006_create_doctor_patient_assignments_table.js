exports.up = function (knex) {
  return knex.schema.createTable("doctor_patient_assignments", (table) => {
    table.bigIncrements("id");
    table.bigInteger("doctor_id").unsigned().notNullable().index();
    table.bigInteger("patient_id").unsigned().notNullable().index();
    table
      .enu("status", ["ACTIVE", "INACTIVE"])
      .notNullable()
      .defaultTo("ACTIVE");
    table.string("assignment_reason", 255).nullable().defaultTo(null);
    table.text("notes").nullable().defaultTo(null);
    table.timestamp("assigned_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("ended_at").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("doctor_id").references("id").inTable("doctors");
    table.foreign("patient_id").references("id").inTable("patients");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("doctor_patient_assignments");
};
