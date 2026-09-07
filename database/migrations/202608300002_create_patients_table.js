exports.up = function (knex) {
  return knex.schema.createTable("patients", (table) => {
    table.bigIncrements("id");
    table.bigInteger("user_id").unsigned().notNullable().unique();
    table.date("date_of_birth").notNullable();
    table.enu("gender", ["MALE", "FEMALE"]).notNullable();
    table.string("address", 255).nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("user_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("patients");
};
