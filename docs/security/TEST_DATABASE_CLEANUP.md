# Integration Test Account Cleanup Safety

`scripts/cleanupIntegrationTestAccounts.js` is an opt-in helper for removing only
reserved Patient, Doctor, and NGO integration-test accounts. Before reading
accounts or issuing deletes, it requires `NODE_ENV=test`, the explicit
`HCMS_ALLOW_INTEGRATION_ACCOUNT_CLEANUP=I_CONFIRM_LOCAL_HCMS_TEST_DB_CLEANUP`
confirmation, a distinct `DB_NAME`, `TEST_DB_NAME=hcms_test_db`, a local MySQL
TCP configuration with only the supported connection options, and a live
connection whose selected schema and server settings match the expected test
database. Candidate accounts must also match the reserved test email pattern
and expected role.

## Limits of the connection checks

A loopback `remoteAddress` proves only that the client connected to a local TCP
endpoint. It does not prove where the MySQL server behind that endpoint runs:
an SSH tunnel, TCP forwarder, container proxy, or similar relay can accept a
local connection and pass it to a remote server. MySQL's reported hostname and
port, together with `DATABASE()`, verify server-reported settings and the
selected schema; they do not prove the server's physical location or that the
server contains no production data. The cleanup helper does not detect or claim
to detect tunnels or forwarded connections.

Run this helper only against a dedicated, disposable MySQL test instance with
no production data or network path to production. Use a dedicated test-only
database account with the minimum required permissions on the test schema and
tables; its credentials must not grant access to production databases. The
explicit environment confirmation is an operational opt-in, not a substitute
for instance isolation or database-account permissions. These deployment
properties must be established by the operator; the helper cannot enforce
them from a local TCP connection alone.
