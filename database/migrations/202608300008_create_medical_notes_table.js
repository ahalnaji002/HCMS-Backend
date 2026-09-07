exports.up = function (knex) {
  return knex.schema.createTable("medical_notes", (table) => {
    table.bigIncrements("id");
    table.bigInteger("medical_record_id").unsigned().notNullable();
    table.bigInteger("doctor_id").unsigned().notNullable();
    table.text("note").notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("medical_record_id").references("id").inTable("medical_records");
    table.foreign("doctor_id").references("id").inTable("doctors");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("medical_notes");
};
