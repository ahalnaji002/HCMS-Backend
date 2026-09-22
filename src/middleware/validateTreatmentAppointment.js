const UNSIGNED_BIGINT_MAX = 18446744073709551615n;
const TEXT_MAX_BYTES = 65535;
const APPROVED_STATUSES = new Set(["SCHEDULED", "COMPLETED", "CANCELLED"]);

const CREATE_FIELDS = new Set([
  "appointment_date",
  "purpose",
  "location",
  "notes",
]);

const UPDATE_FIELDS = new Set([
  "appointment_date",
  "purpose",
  "location",
  "status",
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
  const stringValue = String(value);

  if (!/^[1-9]\d*$/.test(stringValue)) {
    return false;
  }

  try {
    return BigInt(stringValue) <= UNSIGNED_BIGINT_MAX;
  } catch {
    return false;
  }
}

function validatePlanId(req, res, next) {
  if (!isValidPositiveId(req.params.planId)) {
    return validationFailure(res, {
      planId: "planId must be a positive integer",
    });
  }

  return next();
}

function validateAppointmentId(req, res, next) {
  if (!isValidPositiveId(req.params.appointmentId)) {
    return validationFailure(res, {
      appointmentId: "appointmentId must be a positive integer",
    });
  }

  return next();
}

function validateBodyObject(input, res) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    validationFailure(res, { body: "request body must be a JSON object" });
    return false;
  }

  return true;
}

function validateAllowedFields(input, allowedFields, errors) {
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      errors[field] = `${field} is not allowed`;
    }
  }
}

function isValidDateTime(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );

  if (!match) {
    return false;
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
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function validateAppointmentDate(input, errors, required) {
  const value = input.appointment_date;

  if (value === undefined) {
    if (required) {
      errors.appointment_date = "appointment_date is required";
    }
    return;
  }

  if (!isValidDateTime(value)) {
    errors.appointment_date =
      "appointment_date must be a valid datetime in YYYY-MM-DD HH:mm:ss format";
  }
}

function validatePurpose(input, errors, required) {
  const value = input.purpose;

  if (value === undefined) {
    if (required) {
      errors.purpose = "purpose is required";
    }
    return;
  }

  if (typeof value !== "string") {
    errors.purpose = "purpose must be a string";
  } else if (value.trim().length === 0) {
    errors.purpose = "purpose must not be empty";
  } else if (value.length > 255) {
    errors.purpose = "purpose must not exceed 255 characters";
  }
}

function validateLocation(input, errors) {
  const value = input.location;

  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors.location = "location must be a string or null";
  } else if (value.length > 255) {
    errors.location = "location must not exceed 255 characters";
  }
}

function validateNotes(input, errors) {
  const value = input.notes;

  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "string") {
    errors.notes = "notes must be a string or null";
  } else if (Buffer.byteLength(value, "utf8") > TEXT_MAX_BYTES) {
    errors.notes = "notes must not exceed 65535 bytes";
  }
}

function validateStatus(input, errors) {
  const value = input.status;

  if (value !== undefined && !APPROVED_STATUSES.has(value)) {
    errors.status = "status must be one of SCHEDULED, COMPLETED, or CANCELLED";
  }
}

function buildValidatedAppointment(input) {
  const validated = {};

  for (const field of UPDATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      continue;
    }

    validated[field] = field === "purpose" ? input[field].trim() : input[field];
  }

  return validated;
}

function validateCreateTreatmentAppointment(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  validateAllowedFields(input, CREATE_FIELDS, errors);
  validateAppointmentDate(input, errors, true);
  validatePurpose(input, errors, true);
  validateLocation(input, errors);
  validateNotes(input, errors);

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedTreatmentAppointment = buildValidatedAppointment(input);
  return next();
}

function validateUpdateTreatmentAppointment(req, res, next) {
  const input = req.body;

  if (!validateBodyObject(input, res)) {
    return;
  }

  const errors = {};
  validateAllowedFields(input, UPDATE_FIELDS, errors);
  validateAppointmentDate(input, errors, false);
  validatePurpose(input, errors, false);
  validateLocation(input, errors);
  validateStatus(input, errors);
  validateNotes(input, errors);

  if (Object.keys(input).length === 0) {
    errors.body = "at least one editable field is required";
  }

  if (Object.keys(errors).length > 0) {
    return validationFailure(res, errors);
  }

  req.validatedTreatmentAppointment = buildValidatedAppointment(input);
  return next();
}

module.exports = {
  validateAppointmentId,
  validateCreateTreatmentAppointment,
  validatePlanId,
  validateUpdateTreatmentAppointment,
};
