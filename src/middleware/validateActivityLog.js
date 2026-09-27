const {
  APPROVED_ACTIONS,
  APPROVED_ENTITY_TYPES,
  normalizePositiveId,
} = require("../services/activityLogService");

const ALLOWED_QUERY_FIELDS = new Set([
  "page",
  "limit",
  "user_id",
  "action",
  "entity_type",
  "entity_id",
  "date_from",
  "date_to",
]);
const ACTIONS = new Set(APPROVED_ACTIONS);
const ENTITY_TYPES = new Set(APPROVED_ENTITY_TYPES);

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function parsePositiveInteger(value, fieldName, maximum) {
  const stringValue = String(value);
  if (!/^[1-9]\d*$/.test(stringValue)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  const parsed = Number(stringValue);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(
      `${fieldName} must be a positive integer not greater than ${maximum}`,
    );
  }
  return parsed;
}

function parseDateTime(value, fieldName) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
  ) {
    throw new Error(`${fieldName} must use YYYY-MM-DDTHH:mm:ss format`);
  }

  const [year, month, day, hour, minute, second] = value
    .split(/[-T:]/)
    .map(Number);
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
    throw new Error(`${fieldName} must be a valid calendar datetime`);
  }

  return {
    date,
    databaseValue: value.replace("T", " "),
  };
}

function validateListQuery(req, res, next) {
  const errors = {};
  for (const field of Object.keys(req.query)) {
    if (!ALLOWED_QUERY_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  let page = 1;
  let limit = 20;
  const filters = {};

  try {
    if (req.query.page !== undefined) {
      page = parsePositiveInteger(req.query.page, "page", Number.MAX_SAFE_INTEGER);
    }
  } catch (error) {
    errors.page = error.message;
  }

  try {
    if (req.query.limit !== undefined) {
      limit = parsePositiveInteger(req.query.limit, "limit", 100);
    }
  } catch (error) {
    errors.limit = error.message;
  }

  if (
    errors.page === undefined &&
    errors.limit === undefined &&
    page - 1 > Math.floor(Number.MAX_SAFE_INTEGER / limit)
  ) {
    errors.page = "page and limit produce an unsafe pagination offset";
  }

  for (const field of ["user_id", "entity_id"]) {
    if (req.query[field] !== undefined) {
      try {
        filters[field] = normalizePositiveId(req.query[field], field);
      } catch (error) {
        errors[field] = error.message;
      }
    }
  }

  if (req.query.action !== undefined) {
    if (!ACTIONS.has(req.query.action)) {
      errors.action = "action must use an approved Activity Log action";
    } else {
      filters.action = req.query.action;
    }
  }

  if (req.query.entity_type !== undefined) {
    if (!ENTITY_TYPES.has(req.query.entity_type)) {
      errors.entity_type =
        "entity_type must use an approved Activity Log entity type";
    } else {
      filters.entity_type = req.query.entity_type;
    }
  }

  let dateFrom;
  let dateTo;
  try {
    if (req.query.date_from !== undefined) {
      dateFrom = parseDateTime(req.query.date_from, "date_from");
      filters.date_from = dateFrom.databaseValue;
    }
  } catch (error) {
    errors.date_from = error.message;
  }
  try {
    if (req.query.date_to !== undefined) {
      dateTo = parseDateTime(req.query.date_to, "date_to");
      filters.date_to = dateTo.databaseValue;
    }
  } catch (error) {
    errors.date_to = error.message;
  }

  if (dateFrom && dateTo && dateFrom.date > dateTo.date) {
    errors.date_to = "date_to must not be before date_from";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedActivityLogQuery = { page, limit, filters };
  return next();
}

function validateLogId(req, res, next) {
  try {
    req.validatedActivityLogId = normalizePositiveId(
      req.params.logId,
      "logId",
    );
    return next();
  } catch (error) {
    return validationFailure(res, { logId: error.message });
  }
}

module.exports = {
  validateListQuery,
  validateLogId,
};
