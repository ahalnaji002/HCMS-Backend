exports.up = function (knex) {
  return knex.schema.createTable("messages", (table) => {
    table.bigIncrements("id");
    table.bigInteger("sender_id").unsigned().notNullable();
    table.bigInteger("receiver_id").unsigned().notNullable();
    table.text("message_text").notNullable();
    table.boolean("is_read").notNullable().defaultTo(false);
    table.timestamp("sent_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("read_at").nullable().defaultTo(null);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    table.foreign("sender_id").references("id").inTable("users");
    table.foreign("receiver_id").references("id").inTable("users");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("messages");
};
