const { isValidDateOnly } = require("../utils/registrationValidation");

const UNSIGNED_BIGINT_MAX = 18446744073709551615n;
const UNSIGNED_INT_MAX = 4294967295;
const TEXT_MAX_BYTES = 65535;
const EDITABLE_FIELDS = new Set([
  "resource_name",
  "quantity",
  "delivery_date",
  "notes",
]);

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

function validateRequestId(req, res, next) {
  if (!isValidPositiveId(req.params.requestId)) {
    return validationFailure(res, {
      requestId: "requestId must be a positive integer",
    });
  }

  req.validatedResourceRequestId = String(req.params.requestId);
  return next();
}

function validateResourceId(req, res, next) {
  if (!isValidPositiveId(req.params.resourceId)) {
    return validationFailure(res, {
      resourceId: "resourceId must be a positive integer",
    });
  }

  req.validatedResourceId = String(req.params.resourceId);
  return next();
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

function validateFields(input, errors, required) {
  for (const field of Object.keys(input)) {
    if (!EDITABLE_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (input.resource_name === undefined) {
    if (required) {
      errors.resource_name = "resource_name is required";
    }
  } else if (typeof input.resource_name !== "string") {
    errors.resource_name = "resource_name must be a string";
  } else if (input.resource_name.trim().length === 0) {
    errors.resource_name = "resource_name must not be empty";
  } else if (input.resource_name.length > 150) {
    errors.resource_name = "resource_name must not exceed 150 characters";
  }

  if (input.quantity === undefined) {
    if (required) {
      errors.quantity = "quantity is required";
    }
  } else if (
    typeof input.quantity !== "number" ||
    !Number.isSafeInteger(input.quantity) ||
    input.quantity <= 0 ||
    input.quantity > UNSIGNED_INT_MAX
  ) {
    errors.quantity =
      "quantity must be a positive integer not exceeding 4294967295";
  }

  if (
    input.delivery_date !== undefined &&
    input.delivery_date !== null &&
    !isValidDateOnly(input.delivery_date)
  ) {
    errors.delivery_date =
      "delivery_date must be a valid date in YYYY-MM-DD format or null";
  }

  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== "string") {
      errors.notes = "notes must be a string or null";
    } else if (Buffer.byteLength(input.notes, "utf8") > TEXT_MAX_BYTES) {
      errors.notes = "notes must not exceed 65535 bytes";
    }
  }
}

function buildValidatedAllocation(input) {
  const allocation = {};

  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      continue;
    }

    allocation[field] =
      field === "resource_name" ? input[field].trim() : input[field];
  }

  return allocation;
}

function validateCreateResourceAllocation(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  validateFields(input, errors, true);

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedResourceAllocation = buildValidatedAllocation(input);
  return next();
}

function validateUpdateResourceAllocation(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  validateFields(input, errors, false);

  if (Object.keys(input).length === 0) {
    errors.body = "at least one editable field is required";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedResourceAllocation = buildValidatedAllocation(input);
  return next();
}

module.exports = {
  validateCreateResourceAllocation,
  validateRequestId,
  validateResourceId,
  validateUpdateResourceAllocation,
};
