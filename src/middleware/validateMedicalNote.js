const TEXT_MAX_BYTES = 65535;

function validationFailure(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}

function validateCreateMedicalNote(req, res, next) {
  const input = req.body;

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return validationFailure(res, {
      body: "request body must be a JSON object",
    });
  }

  const errors = {};
  const allowedFields = new Set(["note"]);

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }

  if (!Object.prototype.hasOwnProperty.call(input, "note")) {
    errors.note = "note is required";
  } else if (typeof input.note !== "string") {
    errors.note = "note must be a string";
  } else if (input.note.trim().length === 0) {
    errors.note = "note must not be empty";
  } else if (Buffer.byteLength(input.note, "utf8") > TEXT_MAX_BYTES) {
    errors.note = "note must not exceed 65535 bytes";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedMedicalNote = {
    note: input.note.trim(),
  };

  return next();
}

module.exports = {
  validateCreateMedicalNote,
};
