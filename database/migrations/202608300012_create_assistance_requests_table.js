exports.up = function (knex) {
  return knex.schema.createTable("assistance_requests", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable();
    table.bigInteger("doctor_id").unsigned().notNullable();
    table.bigInteger("ngo_id").unsigned().nullable().defaultTo(null);
    table.string("request_type", 100).notNullable();
    table.text("description").notNullable();
    table
      .enu("status", ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED"])
      .notNullable()
      .defaultTo("PENDING");
    table.timestamp("submitted_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("reviewed_at").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
    table.foreign("doctor_id").references("id").inTable("doctors");
    table.foreign("ngo_id").references("id").inTable("ngos");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("assistance_requests");
};
