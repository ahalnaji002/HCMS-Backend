// One line per request, written when the response finishes:
//   2026-11-28T10:00:00.000Z GET /api/notifications 200 12ms user=5
//
// Only the method, the path without its query string, the status, the
// duration and the signed-in user id. No query values, bodies, headers,
// tokens or IP addresses, so nothing a patient typed ends up in the log.
//
// On by default; off while NODE_ENV is "test" (keeps test output readable)
// or when ACCESS_LOG=off.

function accessLogEnabled(env = process.env) {
  if (env.ACCESS_LOG === "off") return false;
  if (env.ACCESS_LOG === "on") return true;
  return env.NODE_ENV !== "test";
}

function formatAccessLogLine({ time, method, path, status, durationMs, userId }) {
  const user = userId ? ` user=${userId}` : "";
  return `${time} ${method} ${path} ${status} ${durationMs}ms${user}`;
}

function createAccessLog({ write = (line) => console.log(line), enabled = accessLogEnabled() } = {}) {
  return function accessLog(req, res, next) {
    if (!enabled) return next();

    const startedAt = process.hrtime.bigint();
    // originalUrl keeps the mount path; drop the query string.
    const path = req.originalUrl.split("?")[0];

    res.on("finish", () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
      write(
        formatAccessLogLine({
          time: new Date().toISOString(),
          method: req.method,
          path,
          status: res.statusCode,
          durationMs,
          userId: req.user?.id,
        }),
      );
    });

    return next();
  };
}

module.exports = {
  accessLogEnabled,
  createAccessLog,
  formatAccessLogLine,
};
