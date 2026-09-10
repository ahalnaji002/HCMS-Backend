exports.up = function (knex) {
  return knex.schema.createTable("doctors", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().notNullable().unique();
    table.string("specialization", 100).notNullable();
    table.string("license_number", 100).notNullable().unique();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("doctors");
};
