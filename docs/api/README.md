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
