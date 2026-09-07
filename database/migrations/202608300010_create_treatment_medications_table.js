exports.up = function (knex) {
  return knex.schema.createTable("treatment_medications", (table) => {
    table.bigIncrements("id");
    table.bigInteger("treatment_plan_id").unsigned().notNullable();
    table.string("medication_name", 150).notNullable();
    table.string("dosage", 100).notNullable();
    table.string("frequency", 100).notNullable();
    table.string("duration", 100).nullable().defaultTo(null);
    table.text("instructions").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("treatment_plan_id").references("id").inTable("treatment_plans");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("treatment_medications");
};
