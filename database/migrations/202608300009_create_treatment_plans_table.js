exports.up = function (knex) {
  return knex.schema.createTable("treatment_plans", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable();
    table.bigInteger("doctor_id").unsigned().notNullable();
    table.string("title", 150).notNullable();
    table.text("general_instructions").nullable().defaultTo(null);
    table
      .enu("status", ["ACTIVE", "COMPLETED", "CANCELLED"])
      .notNullable()
      .defaultTo("ACTIVE");
    table.date("start_date").notNullable();
    table.date("end_date").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
    table.foreign("doctor_id").references("id").inTable("doctors");
    table.check(
      "`end_date` IS NULL OR `end_date` >= `start_date`",
      [],
      "chk_treatment_plans_end_date"
    );
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("treatment_plans");
};
