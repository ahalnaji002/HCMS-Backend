exports.up = function (knex) {
  return knex.schema.alterTable("doctors", (table) => {
    table
      .enu("availability", ["AVAILABLE", "UNAVAILABLE"])
      .notNullable()
      .defaultTo("AVAILABLE");
    table.integer("capacity_limit").unsigned().nullable().defaultTo(null);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable("doctors", (table) => {
    table.dropColumn("capacity_limit");
    table.dropColumn("availability");
  });
};
