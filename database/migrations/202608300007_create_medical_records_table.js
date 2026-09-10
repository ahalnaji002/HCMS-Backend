exports.up = function (knex) {
  return knex.schema.createTable("medical_records", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable().unique();
    table.string("blood_type", 5).nullable().defaultTo(null);
    table.text("allergies").nullable().defaultTo(null);
    table.text("chronic_diseases").nullable().defaultTo(null);
    table.text("medical_history").nullable().defaultTo(null);
    table.text("previous_surgeries").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("medical_records");
};
