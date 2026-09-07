exports.up = function (knex) {
  return knex.schema.createTable("resource_allocations", (table) => {
    table.bigIncrements("id");
    table.bigInteger("assistance_request_id").unsigned().notNullable();
    table.string("resource_name", 150).notNullable();
    table.integer("quantity").unsigned().notNullable().defaultTo(1);
    table.date("delivery_date").nullable().defaultTo(null);
    table.text("notes").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table
      .foreign("assistance_request_id")
      .references("id")
      .inTable("assistance_requests");
    table.check("`quantity` > 0", [], "chk_resource_allocations_quantity");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("resource_allocations");
};
