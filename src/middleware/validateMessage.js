const UNSIGNED_BIGINT_MAX = 18446744073709551615n;
const TEXT_MAX_BYTES = 65535;
const SEND_FIELDS = new Set(["receiver_id", "message_text"]);

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

function validateBodyObject(input, res) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    validationFailure(res, {
      body: "request body must be a JSON object",
    });
    return false;
  }

  return true;
}

function validateSendMessage(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};

  for (const field of Object.keys(input)) {
    if (!SEND_FIELDS.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (input.receiver_id === undefined) {
    errors.receiver_id = "receiver_id is required";
  } else if (!isValidPositiveId(input.receiver_id)) {
    errors.receiver_id = "receiver_id must be a positive integer";
  }

  if (input.message_text === undefined) {
    errors.message_text = "message_text is required";
  } else if (typeof input.message_text !== "string") {
    errors.message_text = "message_text must be a string";
  } else if (input.message_text.trim().length === 0) {
    errors.message_text = "message_text must not be empty";
  } else if (Buffer.byteLength(input.message_text, "utf8") > TEXT_MAX_BYTES) {
    errors.message_text = "message_text must not exceed 65535 bytes";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedMessage = {
    receiver_id: String(input.receiver_id),
    message_text: input.message_text.trim(),
  };

  return next();
}

function buildIdValidator(paramName, requestProperty) {
  return function validateId(req, res, next) {
    if (!isValidPositiveId(req.params[paramName])) {
      return validationFailure(res, {
        [paramName]: `${paramName} must be a positive integer`,
      });
    }

    req[requestProperty] = String(req.params[paramName]);
    return next();
  };
}

const validateConversationUserId = buildIdValidator(
  "userId",
  "validatedConversationUserId",
);
const validateMessageId = buildIdValidator(
  "messageId",
  "validatedMessageId",
);

function validateMarkRead(req, res, next) {
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
  validateConversationUserId,
  validateMarkRead,
  validateMessageId,
  validateSendMessage,
};
