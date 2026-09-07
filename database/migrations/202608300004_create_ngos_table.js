exports.up = function (knex) {
  return knex.schema.createTable("ngos", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().notNullable().unique();
    table.string("organization_name", 150).notNullable();
    table.string("registration_number", 100).nullable().defaultTo(null).unique();
    table.string("address", 255).nullable().defaultTo(null);
    table.string("contact_phone", 30).nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("ngos");
};
