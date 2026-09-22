exports.up = async function (knex) {
  const [{ patient_count: patientCount }] = await knex("patients").count({
    patient_count: "id",
  });

  if (Number(patientCount) > 0) {
    throw new Error(
      "Cannot add required patients.national_id while Patient rows exist; " +
        "assign approved National IDs before applying this migration",
    );
  }

  await knex.schema.alterTable("patients", (table) => {
    table
      .string("national_id", 9)
      .notNullable()
      .unique()
      .checkRegex("^[1-9][0-9]{8}$", "chk_patients_national_id_format");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("patients", (table) => {
    table.dropChecks("chk_patients_national_id_format");
    table.dropUnique(["national_id"]);
    table.dropColumn("national_id");
  });
};
