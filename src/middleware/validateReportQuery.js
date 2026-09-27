const ASSISTANCE_REQUEST_STATUSES = new Set([
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
]);

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function parsePositiveInteger(value, fieldName, maximum) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(
      `${fieldName} must be a positive integer not greater than ${maximum}`,
    );
  }

  return parsed;
}

function validateQuery(allowStatus) {
  return (req, res, next) => {
    const allowedFields = new Set(allowStatus ? ["page", "limit", "status"] : ["page", "limit"]);
    const errors = {};

    for (const field of Object.keys(req.query)) {
      if (!allowedFields.has(field)) {
        errors[field] = `${field} is not allowed`;
      }
    }

    let page = 1;
    let limit = 20;
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

    const filters = {};
    if (allowStatus && req.query.status !== undefined) {
      if (
        typeof req.query.status !== "string" ||
        !ASSISTANCE_REQUEST_STATUSES.has(req.query.status)
      ) {
        errors.status = "status must use an approved Assistance Request status";
      } else {
        filters.status = req.query.status;
      }
    }

    if (Object.keys(errors).length > 0) {
      return validationFailure(res, errors);
    }

    req.validatedReportQuery = { page, limit, filters };
    return next();
  };
}

module.exports = {
  validateAssistanceRequestReportQuery: validateQuery(true),
  validateReportQuery: validateQuery(false),
};
