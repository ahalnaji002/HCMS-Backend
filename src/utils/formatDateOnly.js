function formatDateOnly(value) {
  if (typeof value === "string") {
    const match = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(value);

    if (match) {
      return match[1];
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = String(value.getFullYear()).padStart(4, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  throw new TypeError("Unable to serialize date-only value");
}

module.exports = formatDateOnly;
