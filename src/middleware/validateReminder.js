const UNSIGNED_BIGINT_MAX = 18446744073709551615n;
const CREATE_FIELDS = new Set(["type", "reference_id", "remind_at"]);
const REMINDER_TYPES = new Set(["MEDICATION", "APPOINTMENT"]);

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function isValidPositiveId(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return false;
  }

  try {
    return BigInt(value) <= UNSIGNED_BIGINT_MAX;
  } catch {
    return false;
  }
}

function parseLocalDateTime(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  );

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second, 0);

  if (
    year < 1000 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date;
}

function validateBodyObject(input, res) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    validationFailure(res, {
      body: "request body must be a JSON object",
    });
    return false;
  }

  return true;
}

function validateReminderId(req, res, next) {
  if (!isValidPositiveId(req.params.reminderId)) {
    return validationFailure(res, {
      reminderId: "reminderId must be a positive integer",
    });
  }

  req.validatedReminderId = String(req.params.reminderId);
  return next();
}

function validateCreateReminder(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};

  for (const field of Object.keys(input)) {
    if (!CREATE_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (input.type === undefined) {
    errors.type = "type is required";
  } else if (typeof input.type !== "string" || !REMINDER_TYPES.has(input.type)) {
    errors.type = "type must be MEDICATION or APPOINTMENT";
  }

  if (input.reference_id === undefined) {
    errors.reference_id = "reference_id is required";
  } else if (!isValidPositiveId(input.reference_id)) {
    errors.reference_id = "reference_id must be a positive integer";
  }

  if (input.remind_at === undefined) {
    errors.remind_at = "remind_at is required";
  } else {
    const date = parseLocalDateTime(input.remind_at);

    if (!date) {
      errors.remind_at =
        "remind_at must be a valid datetime in YYYY-MM-DDTHH:mm:ss format";
    } else if (date.getTime() <= Date.now()) {
      errors.remind_at = "remind_at must be in the future";
    }
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedReminder = {
    type: input.type,
    reference_id: String(input.reference_id),
    remind_at: input.remind_at.replace("T", " "),
  };

  return next();
}

function validateCancelReminder(req, res, next) {
  if (!validateBodyObject(req.body, res)) {
    return;
  }

  const fields = Object.keys(req.body);

  if (fields.length > 0) {
    const errors = {};

    for (const field of fields) {
      errors[field] = `${field} is not allowed`;
    }

    return validationFailure(res, errors);
  }

  return next();
}

module.exports = {
  parseLocalDateTime,
  validateCancelReminder,
  validateCreateReminder,
  validateReminderId,
};
