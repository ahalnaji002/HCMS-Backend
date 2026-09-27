const SYSTEM_SETTINGS = [
  {
    setting_key: "system_name",
    setting_value: "HCMS",
    description: "System display name",
  },
  {
    setting_key: "support_email",
    setting_value: null,
    description: "Support email address",
  },
  {
    setting_key: "support_phone",
    setting_value: null,
    description: "Support phone number",
  },
];

exports.seed = async function seedSystemSettings(knex) {
  await knex("system_settings")
    .insert(SYSTEM_SETTINGS)
    .onConflict("setting_key")
    .ignore();
};

exports.SYSTEM_SETTINGS = SYSTEM_SETTINGS;
