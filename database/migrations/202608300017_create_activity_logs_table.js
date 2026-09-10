exports.up = function (knex) {
  return knex.schema.createTable("activity_logs", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().nullable().defaultTo(null);
    table.string("action", 50).notNullable();
    table.string("entity_type", 50).nullable().defaultTo(null);
    table.bigInteger("entity_id").unsigned().nullable().defaultTo(null);
    table.text("description").notNullable();
    table.string("ip_address", 45).nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("activity_logs");
};
