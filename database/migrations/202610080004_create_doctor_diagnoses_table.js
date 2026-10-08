exports.up = function (knex) {
  return knex.schema.createTable("doctor_diagnoses", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable();
    table.bigInteger("doctor_id").unsigned().notNullable();
    table.text("diagnosis").notNullable();
    table.timestamp("documented_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
    table.foreign("doctor_id").references("id").inTable("doctors");
    table.index(["patient_id", "documented_at"]);
    table.index(["doctor_id", "patient_id"]);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("doctor_diagnoses");
};
