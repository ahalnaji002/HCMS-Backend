exports.up = function (knex) {
  return knex.schema.createTable("join_requests", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().notNullable();
    table.enu("request_type", ["DOCTOR", "NGO"]).notNullable();
    table
      .enu("status", ["PENDING", "APPROVED", "REJECTED"])
      .notNullable()
      .defaultTo("PENDING");
    table.bigInteger("reviewed_by_admin_id").unsigned().nullable().defaultTo(null);
    table.timestamp("reviewed_at").nullable().defaultTo(null);
    table.string("rejection_reason", 500).nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users");
    table.foreign("reviewed_by_admin_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("join_requests");
};
