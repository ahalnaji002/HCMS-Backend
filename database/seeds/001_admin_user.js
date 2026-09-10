const bcrypt = require("bcryptjs");

const PASSWORD_SALT_ROUNDS = 12;

exports.seed = async function seedAdmin(knex) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "admin@hcms.local";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || !adminPassword.trim()) {
    throw new Error(
      "ADMIN_PASSWORD must be configured before running the Admin seed.",
    );
  }

  const existingAdmin = await knex("users")
    .select(["id", "password_hash"])
    .where({ email: adminEmail })
    .first();

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(
      adminPassword,
      PASSWORD_SALT_ROUNDS,
    );

    await knex("users").insert({
      full_name: "HCMS Admin",
      email: adminEmail,
      password_hash: passwordHash,
      role: "ADMIN",
      account_status: "ACTIVE",
      phone: null,
    });

    return;
  }

  const updates = {
    full_name: "HCMS Admin",
    role: "ADMIN",
    account_status: "ACTIVE",
    phone: null,
  };

  const passwordMatches = await bcrypt.compare(
    adminPassword,
    existingAdmin.password_hash,
  );

  if (!passwordMatches) {
    updates.password_hash = await bcrypt.hash(
      adminPassword,
      PASSWORD_SALT_ROUNDS,
    );
  }

  await knex("users").where({ id: existingAdmin.id }).update(updates);
};
