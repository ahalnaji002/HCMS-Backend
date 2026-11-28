// Who made the request, for the activity log: the signed-in user and the
// client address Express reports (it follows the trust proxy setting).
function requestActor(req) {
  return { userId: req.user.id, ipAddress: req.ip ?? null };
}

module.exports = requestActor;
