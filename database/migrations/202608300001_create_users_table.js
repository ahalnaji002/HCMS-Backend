exports.up = function (knex) {
  return knex.schema.createTable("users", (table) => {
    table.bigIncrements("id");
    table.string("full_name", 150).notNullable();
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table.enu("role", ["PATIENT", "DOCTOR", "NGO", "ADMIN"]).notNullable();
    table
      .enu("account_status", ["ACTIVE", "INACTIVE", "SUSPENDED"])
      .notNullable()
      .defaultTo("ACTIVE");
    table.string("phone", 30).nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("users");
};
