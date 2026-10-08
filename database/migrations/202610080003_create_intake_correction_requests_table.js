exports.up = function (knex) {
  return knex.schema.createTable("intake_correction_requests", (table) => {
    table.bigIncrements("id");
    table.bigInteger("patient_id").unsigned().notNullable().index();
    table.text("message").notNullable();
    table.enu("status", ["OPEN", "RESOLVED"]).notNullable().defaultTo("OPEN");
    table.text("admin_response").nullable().defaultTo(null);
    table.bigInteger("resolved_by_admin_id").unsigned().nullable().defaultTo(null);
    table.timestamp("resolved_at").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("patient_id").references("id").inTable("patients");
    table.foreign("resolved_by_admin_id").references("id").inTable("users");
    table.index(["status", "created_at"]);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("intake_correction_requests");
};
