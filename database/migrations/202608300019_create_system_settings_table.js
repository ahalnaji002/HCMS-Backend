exports.up = function (knex) {
  return knex.schema.createTable("system_settings", (table) => {
    table.bigIncrements("id");
    table.string("setting_key", 100).notNullable().unique();
    table.text("setting_value").nullable().defaultTo(null);
    table.string("description", 255).nullable().defaultTo(null);
    table.bigInteger("updated_by_admin_id").unsigned().nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("updated_by_admin_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("system_settings");
};
