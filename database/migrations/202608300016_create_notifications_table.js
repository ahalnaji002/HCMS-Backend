exports.up = function (knex) {
  return knex.schema.createTable("notifications", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().notNullable();
    table.string("title", 150).notNullable();
    table.text("message").notNullable();
    table.string("type", 50).notNullable();
    table.boolean("is_read").notNullable().defaultTo(false);
    table.string("reference_type", 50).nullable().defaultTo(null);
    table.bigInteger("reference_id").unsigned().nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("read_at").nullable().defaultTo(null);

    table.foreign("user_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("notifications");
};
