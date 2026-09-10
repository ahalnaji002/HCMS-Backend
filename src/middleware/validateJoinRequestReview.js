const MAX_UNSIGNED_BIGINT = 18446744073709551615n;
const REJECTION_REASON_MAX_LENGTH = 500;
const PROTECTED_REVIEW_FIELDS = [
  "status",
  "reviewed_by_admin_id",
  "reviewed_at",
  "request_type",
  "user_id",
];

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function validateJoinRequestId(req, res, next) {
  const id = req.params.id;
  const valid =
    typeof id === "string" &&
    /^[1-9][0-9]*$/.test(id) &&
    BigInt(id) <= MAX_UNSIGNED_BIGINT;

  if (!valid) {
    return validationFailure(res, {
      id: "id must be a positive integer",
    });
  }

  req.validatedJoinRequestId = id;
  return next();
}

function validateReviewBody(options = {}) {
  const requiresReason = options.requiresReason === true;
  const allowedFields = requiresReason ? new Set(["rejection_reason"]) : new Set();

  return function validateBody(req, res, next) {
    const input = req.body === undefined ? {} : req.body;
    const errors = {};

    if (
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      errors.body = "request body must be a JSON object";
      return validationFailure(res, errors);
    }

    for (const field of Object.keys(input)) {
      if (!allowedFields.has(field)) {
        errors[field] = `${field} is not allowed`;
      }
    }

    for (const field of PROTECTED_REVIEW_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        errors[field] = `${field} is not allowed`;
      }
    }

    if (requiresReason) {
      if (
        typeof input.rejection_reason !== "string" ||
        input.rejection_reason.trim() === ""
      ) {
        errors.rejection_reason =
          "rejection_reason must be a non-empty string";
      } else if (input.rejection_reason.trim().length > REJECTION_REASON_MAX_LENGTH) {
        errors.rejection_reason =
          "rejection_reason must not exceed 500 characters";
      }
    }

    if (Object.keys(errors).length > 0) {
      return validationFailure(res, errors);
    }

    if (requiresReason) {
      req.validatedRejectionReason = input.rejection_reason.trim();
    }

    return next();
  };
}

module.exports = {
  validateApprovalBody: validateReviewBody(),
  validateJoinRequestId,
  validateRejectionBody: validateReviewBody({ requiresReason: true }),
};
