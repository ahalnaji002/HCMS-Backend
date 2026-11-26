const { normalizePositiveId } = require("../services/activityLogService");

const ROLES = new Set(["PATIENT", "DOCTOR", "NGO", "ADMIN"]);
const ACCOUNT_STATUSES = new Set(["ACTIVE", "INACTIVE", "SUSPENDED"]);
const SETTABLE_STATUSES = new Set(["ACTIVE", "SUSPENDED"]);
const SEARCH_MAX_LENGTH = 100;
const LIMIT_MAX = 100;

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function rejectUnknownFields(query, allowed, errors) {
  for (const field of Object.keys(query)) {
    if (!allowed.has(field)) errors[field] = `${field} is not allowed`;
  }
}

function parsePositiveInteger(value, fieldName, maximum) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(`${fieldName} must be a positive integer not greater than ${maximum}`);
  }
  return parsed;
}

function readSearch(query, filters, errors) {
  if (query.search === undefined) return;
  if (typeof query.search !== "string") {
    errors.search = "search must be a string";
    return;
  }
  const search = query.search.trim();
  if (search.length > SEARCH_MAX_LENGTH) {
    errors.search = `search must not exceed ${SEARCH_MAX_LENGTH} characters`;
  } else if (search) {
    filters.search = search;
  }
}

function readAccountStatus(query, filters, errors) {
  if (query.account_status === undefined) return;
  if (!ACCOUNT_STATUSES.has(query.account_status)) {
    errors.account_status = "account_status must be ACTIVE, INACTIVE, or SUSPENDED";
  } else {
    filters.account_status = query.account_status;
  }
}

function validateUserListQuery(req, res, next) {
  const errors = {};
  const filters = {};
  let page = 1;
  let limit = 20;

  rejectUnknownFields(req.query, new Set(["page", "limit", "role", "account_status", "search"]), errors);

  try {
    if (req.query.page !== undefined) page = parsePositiveInteger(req.query.page, "page", 1000000);
  } catch (error) {
    errors.page = error.message;
  }
  try {
    if (req.query.limit !== undefined) limit = parsePositiveInteger(req.query.limit, "limit", LIMIT_MAX);
  } catch (error) {
    errors.limit = error.message;
  }

  if (req.query.role !== undefined) {
    if (!ROLES.has(req.query.role)) errors.role = "role must be PATIENT, DOCTOR, NGO, or ADMIN";
    else filters.role = req.query.role;
  }
  readAccountStatus(req.query, filters, errors);
  readSearch(req.query, filters, errors);

  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedUserListQuery = { filters, page, limit };
  return next();
}

function validateNgoListQuery(req, res, next) {
  const errors = {};
  const filters = {};

  rejectUnknownFields(req.query, new Set(["account_status", "search"]), errors);
  readAccountStatus(req.query, filters, errors);
  readSearch(req.query, filters, errors);

  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedNgoListQuery = { filters };
  return next();
}

function validateUserId(req, res, next) {
  try {
    normalizePositiveId(req.params.userId, "userId");
  } catch {
    return validationFailure(res, { userId: "userId must be a positive integer" });
  }
  return next();
}

function validateAccountStatusUpdate(req, res, next) {
  const body = req.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return validationFailure(res, { body: "request body must be a JSON object" });
  }

  const errors = {};
  rejectUnknownFields(body, new Set(["account_status"]), errors);

  if (body.account_status === undefined) {
    errors.account_status = "account_status is required";
  } else if (!SETTABLE_STATUSES.has(body.account_status)) {
    errors.account_status = "account_status must be ACTIVE or SUSPENDED";
  }

  if (Object.keys(errors).length > 0) return validationFailure(res, errors);

  req.validatedAccountStatus = body.account_status;
  return next();
}

module.exports = {
  validateUserListQuery,
  validateNgoListQuery,
  validateUserId,
  validateAccountStatusUpdate,
};
