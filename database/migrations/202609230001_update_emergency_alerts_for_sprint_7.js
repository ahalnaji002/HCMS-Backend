exports.up = async function (knex) {
  const [{ alert_count: alertCount }] = await knex("emergency_alerts").count({
    alert_count: "id",
  });

  if (Number(alertCount) > 0) {
    throw new Error(
      "Cannot add required emergency_alerts.phone while Emergency Alert rows exist; " +
        "assign approved contact phone values before applying this migration",
    );
  }

  await knex.schema.alterTable("emergency_alerts", (table) => {
    table.bigInteger("patient_id").unsigned().nullable().defaultTo(null).alter();
    table.string("phone", 30).notNullable();
    table.string("location", 255).nullable().defaultTo(null);
    table.text("description").nullable().defaultTo(null).alter();
  });
};

exports.down = async function (knex) {
  const [{ incompatible_count: incompatibleCount }] = await knex("emergency_alerts")
    .whereNull("patient_id")
    .orWhereNull("description")
    .count({ incompatible_count: "id" });

  if (Number(incompatibleCount) > 0) {
    throw new Error(
      "Cannot restore required emergency_alerts.patient_id and description while NULL values exist; " +
        "resolve the affected Emergency Alert records before rolling back this migration",
    );
  }

  await knex.schema.alterTable("emergency_alerts", (table) => {
    table.dropColumn("phone");
    table.dropColumn("location");
    table.bigInteger("patient_id").unsigned().notNullable().alter();
    table.text("description").notNullable().alter();
  });
};
