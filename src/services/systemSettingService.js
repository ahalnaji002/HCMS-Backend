const db = require("../config/database");
const systemSettingModel = require("../models/systemSettingModel");
const { isValidEmail, isValidPalestinianPhone } = require("../utils/registrationValidation");
const activityLogService = require("./activityLogService");

const SETTING_CATALOG = Object.freeze({
  system_name: Object.freeze({ nullable: false }),
  support_email: Object.freeze({ nullable: true }),
  support_phone: Object.freeze({ nullable: true }),
});
const APPROVED_SETTING_KEYS = Object.freeze(Object.keys(SETTING_CATALOG));

class SystemSettingNotFoundError extends Error {
  constructor() {
    super("System Setting not found");
    this.name = "SystemSettingNotFoundError";
  }
}

class SystemSettingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SystemSettingValidationError";
  }
}

function requireApprovedKey(settingKey) {
  if (!Object.prototype.hasOwnProperty.call(SETTING_CATALOG, settingKey)) {
    throw new SystemSettingNotFoundError();
  }
}

function normalizeSettingValue(settingKey, value) {
  requireApprovedKey(settingKey);

  if (value === null) {
    if (!SETTING_CATALOG[settingKey].nullable) {
      throw new SystemSettingValidationError(
        "setting_value must be a non-empty string",
      );
    }
    return null;
  }

  if (typeof value !== "string") {
    throw new SystemSettingValidationError(
      "setting_value must be a string or null",
    );
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new SystemSettingValidationError(
      "setting_value must not be empty",
    );
  }

  const characterLength = Array.from(normalized).length;

  if (settingKey === "system_name") {
    if (characterLength > 100) {
      throw new SystemSettingValidationError(
        "setting_value must not exceed 100 characters",
      );
    }
  } else if (settingKey === "support_email") {
    if (characterLength > 255) {
      throw new SystemSettingValidationError(
        "setting_value must not exceed 255 characters",
      );
    }
    if (!isValidEmail(normalized)) {
      throw new SystemSettingValidationError(
        "setting_value must be a valid email address",
      );
    }
  } else if (!isValidPalestinianPhone(normalized)) {
    throw new SystemSettingValidationError(
      "setting_value must be exactly 10 digits and start with 059 or 056",
    );
  }

  return normalized;
}

async function listSettings() {
  return systemSettingModel.listByKeys(APPROVED_SETTING_KEYS);
}

async function getSetting(settingKey) {
  requireApprovedKey(settingKey);
  const setting = await systemSettingModel.findByKey(settingKey);
  if (!setting) throw new SystemSettingNotFoundError();
  return setting;
}

async function updateSetting(
  settingKey,
  submittedValue,
  adminUserId,
  ipAddress,
) {
  requireApprovedKey(settingKey);

  return db.transaction(async (trx) => {
    const setting = await systemSettingModel.findByKeyForUpdate(settingKey, trx);
    if (!setting) throw new SystemSettingNotFoundError();

    const normalizedValue = normalizeSettingValue(settingKey, submittedValue);
    if (normalizedValue === setting.setting_value) {
      return setting;
    }

    const updated = await systemSettingModel.updateValue(
      setting.id,
      normalizedValue,
      adminUserId,
      trx,
    );

    await activityLogService.recordEvent(
      {
        action: "UPDATE_SYSTEM_SETTING",
        actorUserId: adminUserId,
        entityId: setting.id,
        ipAddress,
      },
      trx,
    );

    return updated;
  });
}

module.exports = {
  APPROVED_SETTING_KEYS,
  SETTING_CATALOG,
  SystemSettingNotFoundError,
  SystemSettingValidationError,
  getSetting,
  listSettings,
  normalizeSettingValue,
  updateSetting,
};
