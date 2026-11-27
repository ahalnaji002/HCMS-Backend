// HCMS stores wall-clock DATETIME values (for example a reminder's remind_at
// as the patient typed it). Node, mysql2 and MySQL must therefore agree on one
// time zone. Node uses the TZ environment variable (Asia/Gaza in production);
// every database connection is set to Node's current UTC offset so that
// CURRENT_TIMESTAMP and the values Node writes mean the same thing.
//
// A numeric offset is used instead of a zone name because managed MySQL
// servers do not always load the time zone tables. Idle pool connections are
// recycled, so a daylight-saving change reaches new connections quickly.

function formatUtcOffset(date = new Date()) {
  const minutesEast = -date.getTimezoneOffset();
  const sign = minutesEast >= 0 ? "+" : "-";
  const absolute = Math.abs(minutesEast);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");

  return `${sign}${hours}:${minutes}`;
}

// knex pool hook: runs once for each new connection.
function syncSessionTimeZone(connection, done) {
  connection.query("SET time_zone = ?", [formatUtcOffset()], (error) => {
    done(error, connection);
  });
}

module.exports = {
  formatUtcOffset,
  syncSessionTimeZone,
};
