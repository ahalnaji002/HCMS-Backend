# HCMS Backend API Documentation

This directory is the dedicated location for detailed HCMS Backend API
documentation.

API documentation must reflect verified behavior from the authoritative
project requirements, database design documents, approved project decisions,
and the current implementation. Do not document proposed or unverified
endpoints as implemented behavior.

As backend endpoints evolve, maintain their detailed routes, authorization,
request fields, response formats, status codes, validation rules, and known
limitations in this file.

## Response conventions

Successful responses use:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Validation failures use status `400`, message `Validation failed`, and an
`errors` object. Other failures use `success: false` and a message. Password
hashes, JWT secrets, and Bearer tokens are not exposed except that a newly
issued access token is returned by a successful login.

## Authentication

### Registration

```http
POST /api/auth/register/patient
POST /api/auth/register/doctor
POST /api/auth/register/ngo
```

All registrations require `full_name`, `email`, `password`, and
`password_confirmation`. Passwords must have at least eight characters and
contain an uppercase letter, lowercase letter, and digit. Confirmation must
match. `phone` is optional; when present it must contain exactly ten digits
and start with `059` or `056`. Email must be unique.

Patient registration also requires `national_id`, `date_of_birth`, and
`gender`; `address` is optional. `national_id` must be a unique string of
exactly nine digits whose first digit is not zero. `date_of_birth` must be a
valid, non-future `YYYY-MM-DD` date, and `gender` must be `MALE` or `FEMALE`.
Registration atomically creates an `ACTIVE` `PATIENT` account and Patient
profile and does not create a Join Request.

Doctor registration also requires `specialization` and unique
`license_number`. It atomically creates an `INACTIVE` `DOCTOR` account,
Doctor profile, and `PENDING` `DOCTOR` Join Request.

NGO registration also requires `organization_name`.
`registration_number`, `phone`, and `address` are optional; a supplied
registration number must be unique. It atomically creates an `INACTIVE` `NGO`
account, NGO profile, and `PENDING` `NGO` Join Request. The request `phone` is
stored as the NGO `contact_phone`.

Successful registration returns `201`. Validation errors return `400`, and
unique email, Patient National ID, Doctor license, or NGO registration-number
conflicts return `409`.

### Login and current user

```http
POST /api/auth/login
GET  /api/auth/me
```

Login requires `email` and `password`. Only `ACTIVE` accounts can log in.
Success returns safe user data and an HS256 JWT containing `user_id`, `role`,
`iat`, and `exp`. Invalid credentials return `401`; valid credentials for an
`INACTIVE` or `SUSPENDED` account return `403`.

`GET /api/auth/me` requires `Authorization: Bearer <token>`. Authentication
verifies the signature and expiry, reloads the current user from MySQL, and
uses the current database role and account status rather than trusting stale
token claims. Missing, malformed, invalid, expired, or deleted-user tokens
return `401`; a non-active current account returns `403`.

### Logout and password reset status

There is currently no backend logout endpoint. Authentication uses stateless
Bearer JWTs and the approved schema has no token revocation store. A client can
log out locally by deleting its token, but the server cannot invalidate that
token before its configured expiry. Describing local deletion as server-side
revocation would be inaccurate.

Password recovery and reset are outside the current release and there are no
password-reset request or reset endpoints. The current schema contains no
verification-code or reset-token storage and there is no email/SMS delivery
infrastructure. The approved future scope is a time-limited, single-use
verification mechanism delivered through an approved channel such as email or
SMS.

## Authorization

Protected endpoints require an `ACTIVE` authenticated account. Role-specific
routes enforce backend RBAC using `PATIENT`, `DOCTOR`, `NGO`, or `ADMIN`.
Missing authentication returns `401`; an authenticated but disallowed role
returns `403`. Resource ownership and active Doctor-Patient Assignment checks
are additionally enforced where described below.

## Profiles

```http
GET   /api/profile
PATCH /api/profile
```

`GET` is available to every authenticated role and returns only the caller's
safe base and role-profile fields. `PATCH` is limited to Patients and Doctors.
Patients may update `full_name`, `phone`, `date_of_birth`, `gender`, and
`address`; Doctors may update `full_name` and `phone`. Protected, unknown, or
cross-role fields are rejected. A Patient's own `GET` response includes their
`national_id`, but the field is immutable through `PATCH` and is not exposed by
Doctor assigned-Patient endpoints.

## Admin Join Requests

All routes below require `ADMIN`:

```http
GET   /api/admin/join-requests
GET   /api/admin/join-requests/:id
PATCH /api/admin/join-requests/:id/approve
PATCH /api/admin/join-requests/:id/reject
```

The list returns `PENDING` requests; detail may return any review state.
Approval atomically marks a pending Doctor/NGO request `APPROVED`, records the
reviewer and review time, refreshes the request timestamp, and activates the
associated user while refreshing that user's timestamp. Rejection requires a
non-empty `rejection_reason` of at most 500 characters, marks the request
`REJECTED`, refreshes its timestamp, records review metadata, and keeps the
user inactive. Row locking prevents a request from being reviewed twice.

Invalid input returns `400`, missing requests return `404`, and repeated or
inconsistent reviews return `409`.

## Admin Doctor-Patient Assignments

All routes below require `ADMIN`:

```http
POST  /api/admin/doctor-patient-assignments
GET   /api/admin/doctor-patient-assignments
GET   /api/admin/doctor-patient-assignments/:id
PATCH /api/admin/doctor-patient-assignments/:id/status
```

Creation requires `doctor_id` and `patient_id`; `assignment_reason` and
`notes` are optional. References must resolve to active accounts with matching
roles. New assignments are `ACTIVE`. List results include active and inactive
history in deterministic newest-first order. Status updates accept `ACTIVE`
or `INACTIVE`; deactivation sets `ended_at`, and reactivation clears it.

Multiple historical rows may exist for a pair, but only one may be `ACTIVE`.
Creation and reactivation enforce this transactionally and preserve history.

## Doctor assigned Patients

Both routes require `DOCTOR`:

```http
GET /api/doctor/patients
GET /api/doctor/patients/:patientId
```

The list includes only Patients currently connected to the authenticated
Doctor by an `ACTIVE` assignment. Detail requires that active assignment.
Invalid unsigned-BIGINT IDs return `400`, a missing Patient returns `404`, and
a missing or inactive assignment returns `403`. Responses contain safe Patient
profile fields only.

## Medical Records and Notes

```http
POST  /api/doctor/patients/:patientId/medical-record
GET   /api/doctor/patients/:patientId/medical-record
PATCH /api/doctor/patients/:patientId/medical-record
GET   /api/patient/medical-record

POST /api/doctor/patients/:patientId/medical-notes
GET  /api/doctor/patients/:patientId/medical-notes
```

Doctor operations require an `ACTIVE` assignment. Medical Record fields are
`blood_type`, `allergies`, `chronic_diseases`, `medical_history`, and
`previous_surgeries`; each Patient has at most one record. Patients have
read-only access to their own record.

Medical Note creation requires non-empty `note`. The server derives its
Medical Record and Doctor. Listing returns only notes authored by the current
Doctor for that Patient. No Patient note route or note update/delete route is
exposed.

## Treatment Plans

```http
POST  /api/doctor/patients/:patientId/treatment-plans
GET   /api/doctor/patients/:patientId/treatment-plans
GET   /api/doctor/patients/:patientId/treatment-plans/:planId
PATCH /api/doctor/patients/:patientId/treatment-plans/:planId
GET   /api/patient/treatment-plans
GET   /api/patient/treatment-plans/:planId
```

Doctor operations require an active assignment. Creation requires `title` and
`start_date`; `general_instructions` and `end_date` are optional. Status is
`ACTIVE`, `COMPLETED`, or `CANCELLED`. Dates are strict `YYYY-MM-DD`, and a
non-null `end_date` must be on or after `start_date`. Patients have read-only
access to their own plans.

Plans support continuing care: a currently assigned Doctor may manage a plan
created by a previous Doctor, while the original `doctor_id` remains unchanged.

## Treatment Medications

```http
POST   /api/doctor/treatment-plans/:planId/medications
GET    /api/doctor/treatment-plans/:planId/medications
GET    /api/doctor/treatment-plans/:planId/medications/:medicationId
PATCH  /api/doctor/treatment-plans/:planId/medications/:medicationId
DELETE /api/doctor/treatment-plans/:planId/medications/:medicationId
GET    /api/patient/treatment-plans/:planId/medications
GET    /api/patient/treatment-plans/:planId/medications/:medicationId
```

Doctor access is derived through the plan's Patient and requires an active
assignment. Creation requires `medication_name`, `dosage`, and `frequency`;
`duration` and `instructions` are optional. Patients can only read medication
data under their own plans.

## Treatment Appointments

```http
POST   /api/doctor/treatment-plans/:planId/appointments
GET    /api/doctor/treatment-plans/:planId/appointments
GET    /api/doctor/treatment-plans/:planId/appointments/:appointmentId
PATCH  /api/doctor/treatment-plans/:planId/appointments/:appointmentId
DELETE /api/doctor/treatment-plans/:planId/appointments/:appointmentId
GET    /api/patient/treatment-plans/:planId/appointments
GET    /api/patient/treatment-plans/:planId/appointments/:appointmentId
```

Doctor access requires an active assignment to the plan's Patient. Creation
requires `appointment_date` in `YYYY-MM-DD HH:mm:ss` and non-empty `purpose`.
The appointment calendar date must be within the plan's inclusive date range;
a null plan end date has no upper bound. Status is `SCHEDULED`, `COMPLETED`, or
`CANCELLED`. Patients can only read appointments under their own plans.

## Assistance Requests

```http
POST /api/doctor/patients/:patientId/assistance-requests
GET  /api/patient/assistance-requests
GET  /api/patient/assistance-requests/:requestId
GET  /api/admin/assistance-requests
GET  /api/admin/assistance-requests/:requestId
PATCH /api/admin/assistance-requests/:requestId/assign
GET  /api/ngo/assistance-requests
GET  /api/ngo/assistance-requests/:requestId
PATCH /api/ngo/assistance-requests/:requestId/status
POST   /api/ngo/assistance-requests/:requestId/resources
GET    /api/ngo/assistance-requests/:requestId/resources
PATCH  /api/ngo/assistance-requests/:requestId/resources/:resourceId
DELETE /api/ngo/assistance-requests/:requestId/resources/:resourceId
GET    /api/patient/assistance-requests/:requestId/resources
GET    /api/doctor/assistance-requests/:requestId/resources
GET    /api/admin/assistance-requests/:requestId/resources
```

The creation route requires an authenticated `DOCTOR` with an `ACTIVE`
Doctor-Patient Assignment for the Patient identified by `patientId`. It accepts
exactly `request_type` and `description`, and both are required non-empty
strings. `request_type` is limited to 100 characters, while `description` must
fit the database `TEXT` capacity.

The server derives `patient_id` from the route and `doctor_id` from the
authenticated Doctor profile. New requests use `ngo_id = NULL` and
`status = PENDING`; IDs, status, NGO assignment, review fields, and timestamps
cannot be supplied by the client.

Patient routes require an authenticated `PATIENT` and provide read-only access
to that Patient's own Assistance Requests. Lists are ordered newest first by
`submitted_at`, with `id` as the deterministic tie-breaker. Missing or
non-owned requests return `404`.

Successful creation returns `201`, and successful list or detail requests
return `200`. Validation failures return `400`, missing resources return `404`,
missing authentication returns `401`, wrong-role access returns `403`, and a
Doctor without an active assignment receives `403`.

Admin Assistance Request routes require an authenticated `ADMIN`. Admins may
list all requests, retrieve one request, and assign a request by sending exactly
`ngo_id`. The selected NGO must exist and its linked user must have the `NGO`
role and an `ACTIVE` account. Only an unassigned request whose status is
`PENDING` may be assigned. Assignment sets `ngo_id` without changing the
request status. Admin lists are ordered by `submitted_at DESC, id DESC`.

NGO Assistance Request routes require an authenticated `NGO` and derive the
NGO identity from its authenticated profile. NGOs may list and retrieve only
requests assigned to them. Accessing a request assigned to another NGO returns
`403`; a missing request returns `404`. NGO lists are ordered by
`submitted_at DESC, id DESC`.

The NGO status endpoint accepts exactly `status` and supports only these
transitions: `PENDING -> UNDER_REVIEW`, `UNDER_REVIEW -> APPROVED`,
`UNDER_REVIEW -> REJECTED`, and `APPROVED -> COMPLETED`. Invalid or stale
transitions return `409`. `reviewed_at` is set when a request becomes
`APPROVED` or `REJECTED`, not when review begins. Completion requires at least
one existing Resource Allocation for the request; otherwise it returns `409`.
Assignment and status changes are transactionally protected against concurrent
state changes.

### Resource Allocations

Resource Allocation creation and management routes require the authenticated
`NGO` to own the Assistance Request. Creation is allowed only while the request
is `APPROVED`. It accepts exactly `resource_name`, `quantity`, optional
`delivery_date`, and optional `notes`; the request relationship is derived from
the URL. `resource_name` is a required non-empty string of at most 150
characters. `quantity` is a required positive integer within the MySQL
unsigned `INT` range. `delivery_date`, when supplied, must be a valid
`YYYY-MM-DD` date. Nullable `delivery_date` and `notes` may be cleared with
`null`.

Updates are partial but require at least one editable field. An allocation must
belong to the request identified in the URL. NGO allocation lists are ordered
by `created_at ASC, id ASC`. Once an Assistance Request becomes `COMPLETED`,
its allocations remain readable but cannot be updated or deleted. Allocation
creation, updates, and deletion never change the Assistance Request status.

Patients may read allocations only for their own Assistance Requests. Doctors
may read allocations only for requests they originally submitted; this access
does not depend on a current Doctor-Patient Assignment. Admins may read
allocations for any existing Assistance Request. These roles have no Resource
Allocation write endpoints.

Malformed IDs or bodies return `400`; missing requests or relationship-scoped
allocations return `404`; wrong-role and ownership violations return `403`;
invalid request-state operations and stale conflicts return `409`. Resource
mutations lock the Assistance Request before allocation rows, preserving the
same lock order as Assistance Request completion.

## Patient-Doctor Messaging

```http
POST  /api/messages
GET   /api/messages/conversations
GET   /api/messages/conversations/:userId
PATCH /api/messages/:messageId/read
```

All Messaging routes require authentication and allow only `PATIENT` and
`DOCTOR` accounts. NGO and Admin accounts receive `403`. The send endpoint
accepts exactly:

```json
{
  "receiver_id": 25,
  "message_text": "How are you feeling today?"
}
```

`receiver_id` is a MySQL unsigned-BIGINT user ID, and `message_text` is a
required non-empty string that must fit the database `TEXT` capacity of 65535
bytes. Unknown fields and client-controlled message IDs, sender IDs, read
state, or timestamps are rejected. The server derives `sender_id` from the
authenticated user and initializes `is_read = false` and `read_at = NULL`.

Sending is permitted only between one Patient and one Doctor whose exact
profiles have a current `ACTIVE` Doctor-Patient Assignment. Patient-to-Patient,
Doctor-to-Doctor, self, NGO, and Admin messaging are not allowed. A missing or
inactive assignment returns `403`.

Conversation lists contain only conversations in which the authenticated user
has sent or received a message. They are ordered by the latest message using
`sent_at DESC, id DESC` and expose only the other participant's `id`,
`full_name`, and `role`, plus the latest message. Conversation history uses the
other participant's user ID, is ordered chronologically by
`sent_at ASC, id ASC`, and returns only message-table fields.

Ending an assignment blocks new messages in both directions but does not hide
existing history from either participant. An unrelated authenticated user
receives `403` and cannot discover or read the conversation. Missing users or
messages return `404`, malformed IDs and bodies return `400`, and missing
authentication returns `401`. No pagination, message editing/deletion,
attachments, realtime transport, notifications, or read receipts beyond the
database read status are included.

The read endpoint accepts an empty JSON object and is receiver-only. It sets
`is_read = true` and `read_at` on the first successful request; repeated calls
are idempotent and preserve the original `read_at` value.

## Notifications

```http
GET   /api/notifications
GET   /api/notifications/unread-count
PATCH /api/notifications/:notificationId/read
PATCH /api/notifications/read-all
```

All Notification routes require an `ACTIVE` authenticated account and are
available to `PATIENT`, `DOCTOR`, `NGO`, and `ADMIN` users. Every operation is
scoped to `notifications.user_id = authenticated user id`; `user_id` is never
accepted from client input. A missing or non-owned Notification returns `404`
without revealing whether another user owns it.

The list returns only Notification table fields: `id`, `user_id`, `title`,
`message`, `type`, `is_read`, `reference_type`, `reference_id`, `created_at`,
and `read_at`. Results are ordered by `created_at DESC, id DESC`. The unread
count response contains `data.unread_count` for the current user only.

Both PATCH endpoints accept only an empty JSON object. Marking one Notification
read sets `is_read = true` and `read_at` on the first call. Repeated calls are
idempotent and preserve the original `read_at`. `read-all` changes only the
current user's unread rows and returns the number changed as
`data.updated_count`.

Notifications are created only by approved Backend events; there is no manual
or public Notification POST endpoint. The allowed polymorphic reference types
are `ASSISTANCE_REQUEST`, `EMERGENCY_ALERT`, `TREATMENT_PLAN`, and the
internally generated `REMINDER` type described below.
Their `reference_id` values are validated as MySQL unsigned-BIGINT IDs and the
referenced rows must exist. The Backend derives recipients from the referenced
entity relationship. The current event hooks are:

- Admin assignment of an Emergency Alert notifies only the assigned Doctor.
- An assigned Doctor changing an Emergency Alert from `ASSIGNED` to
  `IN_PROGRESS` notifies the registered Patient.
- An assigned Doctor changing an Emergency Alert from `IN_PROGRESS` to
  `RESOLVED` notifies the registered Patient.
- A Treatment Plan update notifies the affected Patient.
- Each approved Assistance Request transition (`PENDING -> UNDER_REVIEW`,
  `UNDER_REVIEW -> APPROVED`, `UNDER_REVIEW -> REJECTED`, and
  `APPROVED -> COMPLETED`) notifies the beneficiary Patient and submitting
  Doctor.

For these events, `type` uses the same approved literal as `reference_type`.
The state mutation and all resulting Notification inserts share one database
transaction, so either all changes commit or all roll back. Failed or repeated
invalid transitions do not create Notifications. For registered Patients, the
Emergency Alert status transition and its Patient Notification commit or roll
back together. Visitor Emergency Alerts have no registered Patient recipient;
their Doctor status transitions still succeed but create no Patient
Notification. Message and Resource Allocation activity does not create
Notifications, and this API does not
provide SMS, email, push, deletion, filtering, or pagination.

Malformed IDs or non-empty PATCH bodies return `400`; missing authentication
returns `401`; and missing or non-owned Notifications return `404`.

## Reminders

```http
POST  /api/patient/reminders
GET   /api/patient/reminders
GET   /api/patient/reminders/:reminderId
PATCH /api/patient/reminders/:reminderId/cancel
```

All Reminder routes require an `ACTIVE` authenticated `PATIENT`. Patients may
create, list, view, and cancel only their own Reminders. Ownership is enforced
with `reminders.user_id = authenticated user id`; a missing or non-owned
Reminder returns `404`. No Doctor, NGO, or Admin Reminder endpoint is exposed.

Creation accepts exactly:

```json
{
  "type": "MEDICATION",
  "reference_id": "42",
  "remind_at": "2026-09-29T08:00:00"
}
```

`type`, `reference_id`, and `remind_at` are required and non-null. `type` is
exactly `MEDICATION` or `APPOINTMENT`. The Backend maps these values to
`TREATMENT_MEDICATION` and `TREATMENT_APPOINTMENT` respectively and stores the
result as `reference_type`; clients cannot supply that field. The referenced
row must exist and belong through its Treatment Plan to the authenticated
Patient. A missing or type-mismatched reference returns `404`; an existing
reference belonging to another Patient returns `403`.

`reference_id` and `reminderId` use the positive MySQL unsigned-BIGINT range.
Unsafe JSON numbers, zero, negatives, decimals, malformed values, and values
above `18446744073709551615` return `400`. Creation also rejects `user_id`,
`reference_type`, `status`, `sent_at`, timestamps, and all unknown fields.

`remind_at` must be a real local calendar datetime in the exact
`YYYY-MM-DDTHH:mm:ss` format, without an offset or timezone suffix, and must be
strictly later than the current application time. Alternate formats and past
or current datetimes return `400`. The calendar value is stored as a MySQL
`DATETIME` without shifting its intended local date or time.

New Reminders are created with server-derived `user_id`, `status = PENDING`,
and `sent_at = null`. Lists contain only the current Patient's rows and are
ordered by `remind_at ASC, id ASC`; filtering and pagination are not provided.
The API exposes only Reminder table fields.

The status workflow is:

```text
PENDING --due worker--> SENT
PENDING --Patient-----> CANCELLED
```

Cancellation accepts exactly an empty JSON object and refreshes `updated_at`.
Only `PENDING` Reminders can be cancelled; attempting to cancel `SENT` or
`CANCELLED` returns `409`. There is no reschedule, delete, manual-send, or
general-update endpoint.

An internal worker scans once per minute for `PENDING` rows whose `remind_at`
is due. A successful delivery sets `status = SENT`, sets `sent_at` to the
actual delivery time, refreshes `updated_at`, and creates exactly one
Notification for the Reminder owner with:

```text
title          = Reminder due
message        = Reminder #<id> is due.
type           = REMINDER
reference_type = REMINDER
reference_id   = reminder.id
```

The worker is started only by the server process and is disabled in the test
environment. Its interval does not keep the Node.js process alive by itself.
Delivery and Notification creation share one database transaction. Delivery
and cancellation lock and reread the Reminder, recheck its state, and use a
conditional state update. Concurrent scans cannot duplicate Notifications,
and cancellation and delivery cannot both succeed. If Notification insertion
fails, the transaction rolls back: the Reminder remains `PENDING`, `sent_at`
stays null, and a later worker run may retry it. No `FAILED` state or retry
counter is used.

Malformed requests return `400`; unauthenticated requests return `401`;
wrong-role access returns `403`; missing or non-owned Reminders return `404`;
and invalid state transitions return `409`. Email, SMS, push, WebSockets,
realtime delivery, filtering, and pagination are outside this API.

## Activity Logs

```http
GET /api/admin/activity-logs
GET /api/admin/activity-logs/:logId
```

Both endpoints require an `ACTIVE` authenticated `ADMIN`. Patients, Doctors,
NGOs, and unauthenticated callers cannot read Activity Logs. Logs are immutable:
there is no public or role-specific `POST`, `PATCH`, `PUT`, or `DELETE` endpoint.

The list accepts only these optional query parameters:

```text
page
limit
user_id
action
entity_type
entity_id
date_from
date_to
```

`page` defaults to `1`. `limit` defaults to `20` and cannot exceed `100`; both
must be positive integers. `user_id` and `entity_id` must be positive MySQL
unsigned-BIGINT values. `date_from` and `date_to` use the exact local datetime
format `YYYY-MM-DDTHH:mm:ss`, must be real calendar values, and `date_from`
cannot be later than `date_to`. Unknown or invalid query parameters return
`400`. IP filtering, description search, arbitrary sorting, status/role
filters, and cursor pagination are not supported.

Results are ordered by `created_at DESC, id DESC` and returned as:

```json
{
  "success": true,
  "message": "Activity Logs retrieved successfully",
  "data": {
    "items": [],
    "page": 1,
    "limit": 20,
    "total": 0,
    "total_pages": 0
  }
}
```

List and detail expose only `id`, `user_id`, `action`, `entity_type`,
`entity_id`, `description`, `ip_address`, and `created_at`. Detail does not
expand the actor or referenced entity. An invalid `logId` returns `400`; a
missing log returns `404`. Missing authentication returns `401`, and a
non-Admin role returns `403`.

The approved action and entity mappings are:

| Action | Entity type | Recorded workflow |
|---|---|---|
| `APPROVE_JOIN_REQUEST` | `JOIN_REQUEST` | Admin approves a Join Request |
| `REJECT_JOIN_REQUEST` | `JOIN_REQUEST` | Admin rejects a Join Request |
| `ASSIGN_EMERGENCY_ALERT` | `EMERGENCY_ALERT` | Admin assigns an Emergency Alert |
| `UPDATE_EMERGENCY_STATUS` | `EMERGENCY_ALERT` | Assigned Doctor changes Emergency status |
| `CREATE_ASSISTANCE_REQUEST` | `ASSISTANCE_REQUEST` | Doctor creates an Assistance Request |
| `UPDATE_ASSISTANCE_STATUS` | `ASSISTANCE_REQUEST` | Assigned NGO changes Assistance status |
| `CREATE_RESOURCE_ALLOCATION` | `RESOURCE_ALLOCATION` | Assigned NGO creates an allocation |
| `UPDATE_RESOURCE_ALLOCATION` | `RESOURCE_ALLOCATION` | Assigned NGO updates an allocation |
| `DELETE_RESOURCE_ALLOCATION` | `RESOURCE_ALLOCATION` | Assigned NGO deletes an allocation |
| `UPDATE_SYSTEM_SETTING` | `SYSTEM_SETTING` | Admin changes a predefined System Setting value |

For these events, `user_id` is always the authenticated actor, and
`ip_address` is the Express-resolved `req.ip` or `NULL` when unavailable. The
Backend does not read or store raw forwarding headers and does not alter the
application's proxy-trust configuration. `action`, `entity_type`, `entity_id`,
and the fixed human-readable description are generated and validated by the
Backend; clients cannot submit Activity Logs or control audit fields.

The business mutation, existing Notifications, and Activity Log insertion use
the same database transaction. Failed, forbidden, stale, or conflicting
operations create no log. Activity Log insertion failure rolls back the
business mutation and all other transaction-scoped side effects. Resource
Allocation deletion validates and locks the allocation before deletion; its
Activity Log retains the deleted allocation ID and remains readable without
attempting to resolve the removed row.

Descriptions contain only the approved resource identifier and, for status
events, the validated persisted status. Passwords, hashes, tokens,
authorization headers, national IDs, phone numbers, request bodies, serialized
profiles, rejection reasons, medical data, messages, Emergency or Assistance
descriptions, Treatment details, and arbitrary client strings are not logged.

No Activity Logs are currently created for authentication, registration,
profile changes, Doctor-Patient Assignment changes, medical/treatment data,
Patient Emergency creation or cancellation, Messages, Notification reads,
Reminders, GET/read operations, reports, dashboards, visitors, or automatic
system events.

## System Settings

```http
GET   /api/admin/settings
GET   /api/admin/settings/:key
PATCH /api/admin/settings/:key
```

All System Setting endpoints require an authenticated `ADMIN`. There is no
public, Patient, Doctor, or NGO settings endpoint. Settings are predefined and
their keys are immutable; the API exposes no POST, DELETE, or bulk-update
operation.

Exactly three non-secret settings are approved:

| Key | Default | Description | Validation |
|---|---|---|---|
| `system_name` | `HCMS` | System display name | Required trimmed string, 1–100 characters |
| `support_email` | `NULL` | Support email address | `NULL` or trimmed valid email, 1–255 characters |
| `support_phone` | `NULL` | Support phone number | `NULL` or exactly 10 digits beginning with `059` or `056` |

Empty and whitespace-only strings are invalid. Numbers, booleans, objects, and
arrays are not coerced. Only surrounding whitespace is removed; embedded phone
formatting or spaces are rejected.

The list returns only approved catalog rows, ordered by `setting_key ASC`. An
arbitrary database row is never exposed. Detail and update return `404` for an
unknown, unapproved, or unexpectedly missing predefined key. PATCH accepts
exactly:

```json
{
  "setting_value": "HCMS"
}
```

Client-supplied IDs, keys, descriptions, actor metadata, timestamps, and
unknown fields return `400`. PATCH never creates a missing row. Responses
expose exactly `id`, `setting_key`, `setting_value`, `description`, and
`updated_at`; they omit `updated_by_admin_id`, `created_at`, and joined user
information.

A real change locks the setting row in a transaction, stores the normalized
value, derives `updated_by_admin_id` from the authenticated Admin, and refreshes
`updated_at`. It creates exactly one Activity Log in that transaction using
`UPDATE_SYSTEM_SETTING`, `SYSTEM_SETTING`, the numeric setting ID, and the
fixed description `System Setting #<id> updated`. The request IP is recorded,
but the key and old/new values are not included in the log. A log insertion
failure rolls back the value and all update metadata.

Submitting a normalized value identical to the locked current value returns
`200` as a no-op. It does not change the value, actor, or timestamp and creates
no Activity Log; `NULL` to `NULL` behaves the same way. Concurrent updates
serialize on the setting row. Identical concurrent values produce one actual
change and one log, while different serialized values may each change the row
and create one log per actual change.

The System Setting seed inserts the three missing catalog rows without
overwriting an existing value or metadata. JWT secrets, database or SMTP
credentials, API/encryption keys, tokens, administrator credentials, private
deployment configuration, and other environment secrets are not System
Settings and are never exposed by these endpoints.

## Dashboards and Basic Reports

All dashboard and report endpoints require an `ACTIVE` authenticated account
and use the existing role-router authorization. Dashboard values are current
state counts, are always JSON numbers, and remain present as numeric `0` when
no matching rows exist. Every dashboard and paginated report reads all of its
queries in one `REPEATABLE READ` database transaction for a consistent
snapshot. These read-only operations take no explicit row locks, mutate no
data, and create no Activity Logs.

### Admin Dashboard

```http
GET /api/admin/dashboard
```

Requires `ADMIN` and returns exactly:

- `total_patients`: Patient profiles whose joined user is `ACTIVE`.
- `total_doctors`: Doctor profiles whose joined user is `ACTIVE`.
- `total_ngos`: NGO profiles whose joined user is `ACTIVE`.
- `pending_join_requests`: Join Requests with status `PENDING`.
- `active_emergency_alerts`: all Emergency Alerts whose status is not
  `RESOLVED`, including Visitor alerts with no Patient.
- `pending_assistance_requests`: Assistance Requests with status `PENDING`.

Inactive Patient, Doctor, and NGO accounts do not contribute to their profile
totals. Other metrics use their documented current status predicates.

### Patient Dashboard

```http
GET /api/patient/dashboard
```

Requires `PATIENT`; the Patient profile is derived from the authenticated user.
It returns exactly:

- `active_treatment_plans`: the Patient's Treatment Plans with status `ACTIVE`.
- `pending_reminders`: the authenticated user's Reminders with status
  `PENDING`.
- `active_emergency_alerts`: the Patient's Emergency Alerts whose status is not
  `RESOLVED`; Visitor and other Patients' alerts are excluded.
- `pending_assistance_requests`: the Patient's Assistance Requests with status
  `PENDING`.
- `unread_notifications`: the authenticated user's Notifications where
  `is_read` is false, using the existing unread-count behavior.

A missing Patient profile returns `404`.

### Doctor Dashboard

```http
GET /api/doctor/dashboard
```

Requires `DOCTOR`; the Doctor profile is derived from the authenticated user.
It returns exactly:

- `active_patients`: distinct Patient IDs in the Doctor's `ACTIVE`
  Doctor-Patient Assignments; inactive history and duplicate Patient history do
  not inflate the count.
- `assigned_emergency_alerts`: alerts assigned to the Doctor whose status is
  not `RESOLVED`.
- `submitted_assistance_requests`: all Assistance Requests submitted by the
  Doctor, regardless of status.

A missing Doctor profile returns `404`.

### NGO Dashboard

```http
GET /api/ngo/dashboard
```

Requires `NGO`; the NGO profile is derived from the authenticated user. It
returns exactly:

- `assigned_assistance_requests`: all Assistance Requests whose `ngo_id` is
  the authenticated NGO, regardless of status.
- `resource_allocations`: the number of Resource Allocation rows joined through
  those Assistance Requests; this is a row count and never a sum of quantity.

Requests and allocations belonging to another NGO are excluded. A missing NGO
profile returns `404`.

### Admin Basic Reports

The three report endpoints require `ADMIN`:

```http
GET /api/admin/reports/patients
GET /api/admin/reports/treatment-plans
GET /api/admin/reports/assistance-requests
```

All use `page=1` and `limit=20` by default, allow a maximum `limit` of `100`,
and order by `created_at DESC, id DESC`. Duplicate, unknown, non-positive, or
unsafe pagination values return `400`; values are not clamped. An empty page
returns the requested `page` and `limit`, an empty `items` array, and the
database-derived `total` and `total_pages`.

Response `data` has this shape:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "total_pages": 0
}
```

The Patient report permits only `page` and `limit`. Each item exposes exactly
`id`, `user_id`, joined `full_name`, and `created_at`. National ID, phone,
email, password data, medical data, and other profile fields are excluded.

The Treatment Plan report permits only `page` and `limit`. Each item exposes
exactly `id`, `patient_id`, `doctor_id`, `status`, `start_date`, `end_date`, and
`created_at`. Instructions, medications, appointments, clinical narrative,
and joined personal data are excluded.

The Assistance Request report additionally permits only the optional `status`
filter, using `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `COMPLETED`.
The filter applies consistently to both `items` and `total`. Each item exposes
exactly `id`, `patient_id`, `doctor_id`, `ngo_id`, `status`, `request_type`,
`created_at`, and `updated_at`; descriptions and joined profile data are
excluded.

These basic reports provide no date filters, trends, analytics, grouping,
exports, generated timestamps, or recent-activity feed. Dashboard and report
responses expose no medical narrative, message content, contact credentials,
tokens, secrets, or System Setting values.

## HTTPS deployment requirement

The Express process currently listens for HTTP and has no TLS certificate or
reverse-proxy configuration in this repository. NFR-1.3 must therefore be
satisfied in deployment by terminating TLS at a trusted reverse proxy or load
balancer and forwarding requests only over a protected network path. Production
must redirect or reject plain HTTP at the edge. If proxy-derived protocol or
secure cookies are later used, `trust proxy` must be configured only for the
known proxy topology. This repository does not yet contain deployment evidence,
so HTTPS compliance is not claimed as verified.

## Emergency Alerts

```http
POST  /api/emergency-alerts
POST  /api/patient/emergency-alerts
GET   /api/patient/emergency-alerts
GET   /api/patient/emergency-alerts/:alertId
PATCH /api/patient/emergency-alerts/:alertId/cancel
```

`POST /api/emergency-alerts` is public and does not require authentication.
It creates a Visitor Emergency Alert with `patient_id = NULL`. The public
endpoint provides creation only; no public list, detail, tracking, update, or
cancellation endpoint is exposed.

The Patient routes require an authenticated `PATIENT`. Patient-created alerts
derive `patient_id` from the authenticated Patient profile, and Patients may
list, view, and cancel only their own alerts. Lists are returned newest first
by `sent_at`, with `id` as the deterministic tie-breaker.

Creation requires `phone`; `location` and `description` are optional.
`patient_id`, `priority`, `status`, assignment fields, and other unknown fields
are not accepted from the client. Every new alert is created by the server
with `priority = HIGH` and `status = PENDING_ASSIGNMENT`.

A Patient may cancel only their own alert while its status is
`PENDING_ASSIGNMENT`. Cancellation changes the status to `CANCELLED` and
updates `updated_at`. Cancellation does not accept request-body fields. The
state transition is conditionally enforced against the current alert status
to prevent cancellation after assignment or another state change.

Successful creation returns `201`; successful list, detail, and cancellation
return `200`. Validation failures return `400`, missing or non-owned Patient
alerts return `404`, missing authentication returns `401`, and an authenticated
non-Patient role attempting to use Patient routes returns `403`.

### Admin Emergency Alert Monitoring and Assignment

```http
GET   /api/admin/emergency-alerts
GET   /api/admin/emergency-alerts/:alertId
PATCH /api/admin/emergency-alerts/:alertId/assign
```

These routes require an authenticated `ADMIN`. Admins may list all Emergency
Alerts and view a specific alert. Lists are returned newest first by `sent_at`,
with `id` as the deterministic tie-breaker.

Assignment requires only `doctor_id`. The selected Doctor must exist, have an
`ACTIVE` Doctor account, and have either `General Medicine` or
`Emergency Medicine` as their specialization.

Only an alert with `status = PENDING_ASSIGNMENT` may be assigned. A successful
assignment sets `assigned_doctor_id`, `assigned_by_admin_id`, `assigned_at`,
and changes the alert status to `ASSIGNED`. The assignment is performed inside
a transaction and prevents reassignment after the alert state changes.

Successful list, detail, and assignment requests return `200`. Validation
failures return `400`, missing alerts or Doctors return `404`, and assignment
state conflicts return `409`.

### Doctor Emergency Alert Status Workflow

```http
PATCH /api/doctor/emergency-alerts/:alertId/status
```

This route requires an authenticated `DOCTOR`, and only the Doctor assigned to
the Emergency Alert may update it. The Doctor identity is derived from the
authenticated account; `doctor_id` is not accepted from the client. Missing
alerts and alerts assigned to another Doctor both return `404` to avoid leaking
alert existence.

The request body accepts exactly one field:

```json
{
  "status": "IN_PROGRESS"
}
```

The only allowed transitions are `ASSIGNED -> IN_PROGRESS` and
`IN_PROGRESS -> RESOLVED`. Starting progress sets `responded_at`, leaves
`resolved_at` unchanged, and refreshes `updated_at`. Resolving preserves the
existing `responded_at`, sets `resolved_at`, and refreshes `updated_at`.

The transition runs in a transaction that locks the Emergency Alert and
conditionally updates its current status. Successful updates return `200`.
Malformed identifiers, invalid bodies, unknown fields, and unsupported status
values return `400`; missing authentication returns `401`; authenticated
non-Doctor roles return `403`; missing or non-owned alerts return `404`; and
invalid or stale workflow transitions return `409`. No Doctor Emergency Alert
list or detail route is exposed.
