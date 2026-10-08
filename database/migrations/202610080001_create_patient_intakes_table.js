exports.up = function (knex) {
  return knex.schema.createTable("patient_intakes", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable().unique();
    table.text("current_problem").notNullable();
    table.text("symptoms").notNullable();
    table.string("symptom_onset", 255).notNullable();
    table.enu("chronic_conditions_answer", ["YES", "NO", "UNKNOWN"]).notNullable();
    table.text("chronic_conditions_details").nullable().defaultTo(null);
    table.enu("medications_answer", ["YES", "NO", "UNKNOWN"]).notNullable();
    table.text("medications_details").nullable().defaultTo(null);
    table.enu("allergies_answer", ["YES", "NO", "UNKNOWN"]).notNullable();
    table.text("allergies_details").nullable().defaultTo(null);
    table.text("additional_information").nullable().defaultTo(null);
    table
      .enu("status", ["SUBMITTED", "UNDER_REVIEW", "DOCTOR_ASSIGNED"])
      .notNullable()
      .defaultTo("SUBMITTED");
    table.timestamp("submitted_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("review_started_at").nullable().defaultTo(null);
    table.bigInteger("review_started_by_admin_id").unsigned().nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
    table
      .foreign("review_started_by_admin_id")
      .references("id")
      .inTable("users");
    table.index(["status", "submitted_at"]);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("patient_intakes");
};
