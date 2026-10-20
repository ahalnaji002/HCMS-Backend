# HCMS Backend

Backend API for the **Healthcare Conflict Management System (HCMS)**.

## Project Overview

HCMS Backend provides the database, authentication, authorization, and API foundation for the Healthcare Conflict Management System.

## Technologies

- Node.js
- Express.js
- MySQL
- Knex.js
- bcryptjs
- JSON Web Token (JWT)
- CORS
- dotenv

## Requirements

Make sure the following are installed:

- Node.js
- npm
- MySQL
- Git

## Installation

Clone the repository:

```bash
git clone https://github.com/ahalnaji002/HCMS-Backend.git
```

Enter the project directory:

```bash
cd HCMS-Backend
```

Switch to the development branch:

```bash
git checkout develop
```

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as a reference.

Example:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hcms_db

JWT_SECRET=
JWT_EXPIRES_IN=1h

ADMIN_EMAIL=admin@hcms.local
ADMIN_PASSWORD=
```

Set `JWT_SECRET` to a strong private random value.

`ADMIN_PASSWORD` must also be configured locally before running the Admin seed.

> Do not commit the `.env` file, real passwords, JWT secrets, or tokens to GitHub.

## Database Setup

Create the development database:

```sql
CREATE DATABASE hcms_db;
```

Run database migrations:

```bash
npm run migrate
```

Run database seeds:

```bash
npm run seed
```

Rollback the latest migration batch:

```bash
npm run migrate:rollback
```

The project includes dependency-ordered Knex migrations for the HCMS schema and approved intake/care-coordination extensions.

## Database Access

Application queries use the shared Knex instance in:

```text
src/config/database.js
```

Model methods accept an optional Knex transaction as their final argument so service-layer workflows can compose related writes atomically.

## Run the Backend

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The API runs by default at:

```text
http://localhost:3000
```

## Features

- Express-based REST API foundation.
- Reusable Knex runtime database connection.
- Dependency-ordered migrations for the HCMS baseline and approved schema extensions.
- Data-access modules for users, patients, doctors, NGOs, and Join Requests.
- Transactional Patient Registration.
- Transactional Doctor Registration with Join Request creation.
- Transactional NGO Registration with Join Request creation.
- bcrypt password hashing.
- Login with JWT authentication.
- Current-user authentication middleware.
- Role-Based Access Control (RBAC).
- Role-specific current-profile viewing and approved self-service updates.
- Admin Join Request approval and rejection workflow.
- Transactional and concurrency-safe Join Request reviews.
- Admin creation and viewing of current and historical Doctor-Patient Assignments.
- Transactional Doctor-Patient Assignment status transitions.
- Active-assignment authorization for Doctor access to Patient medical care.
- Doctor management and Patient self-viewing of Medical Records.
- Doctor-owned Medical Notes for actively assigned Patients.
- Continuing-care Treatment Plans with Patient read-only access.
- Treatment Medication and Appointment management scoped to Treatment Plans.
- Patient self-reported intake submission, pre-review editing, and administrator review locking.
- Admin-managed doctor availability and capacity warnings, with separate assignment and emergency workload counts.
- Multiple doctor assignments per patient, required internal assignment reasons, and per-doctor diagnoses.
- Patient correction requests routed to administrators after review begins.

## Patient Intake and Care Coordination

After login, a Patient can submit one self-reported intake using `POST /api/patient/intake`; the Patient can edit it with `PUT` only until an Admin starts review. Admins review submissions through `GET /api/admin/patient-intakes` and lock one with `PATCH /api/admin/patient-intakes/:intakeId/start-review`. Doctors can read an assigned Patient's intake at `GET /api/doctor/patients/:patientId/intake`.

Doctor assignments require the reviewed intake and an internal `assignment_reason`. Routine assignments to unavailable doctors are rejected. Capacity only produces an administrative warning and never blocks an assignment. Emergency alert assignment stays on its separate route and remains possible for unavailable doctors when they meet the existing emergency eligibility rules.

See [API documentation](docs/api/README.md) and [approved intake requirements](docs/requirements/PATIENT_INTAKE_AND_CARE_COORDINATION.md) for authorization and payload details.

## API

### Patient Registration

```http
POST /api/auth/register/patient
```

Required JSON fields:

- `full_name`
- `email`
- `password`
- `password_confirmation`
- `national_id`
- `date_of_birth`
- `gender`

Optional JSON fields:

- `phone`
- `address`

Patient registration creates the user and patient profile in one transaction.

The server assigns:

- role: `PATIENT`
- account status: `ACTIVE`

Patient accounts do not create Join Requests and registration does not return a token.

`national_id` must be a unique string of exactly 9 digits and must not start
with `0`.

`date_of_birth` must be a valid `YYYY-MM-DD` date and cannot be in the future.

The response serializes `date_of_birth` as a date-only `YYYY-MM-DD` string.

### Doctor Registration

```http
POST /api/auth/register/doctor
```

Required JSON fields:

- `full_name`
- `email`
- `password`
- `password_confirmation`
- `specialization`
- `license_number`

Optional JSON field:

- `phone`

Doctor registration creates the user, doctor profile, and pending Join Request in one transaction.

The server assigns:

- role: `DOCTOR`
- account status: `INACTIVE`
- request type: `DOCTOR`
- request status: `PENDING`

Doctor registration does not return a token.

### NGO Registration

```http
POST /api/auth/register/ngo
```

Required JSON fields:

- `full_name`
- `email`
- `password`
- `password_confirmation`
- `organization_name`

Optional JSON fields:

- `registration_number`
- `phone`
- `address`

NGO registration creates the user, NGO profile, and pending Join Request in one transaction.

The server assigns:

- role: `NGO`
- account status: `INACTIVE`
- request type: `NGO`
- request status: `PENDING`

The request phone is stored in the approved NGO `contact_phone` field.

NGO registration does not return a token.

### Login

```http
POST /api/auth/login
```

Required JSON fields:

- `email`
- `password`

Email is trimmed. Password is compared unchanged using asynchronous `bcrypt.compare`.

Login does not require `password_confirmation` and does not reapply registration password-complexity validation.

Successful login for an `ACTIVE` account returns safe user information and a JWT.

Incorrect credentials return:

```text
401 Invalid email or password
```

Valid credentials for an `INACTIVE` or `SUSPENDED` account do not create a
session and return `403`. For an inactive Doctor or NGO applicant with a
pending or rejected Join Request, the response also returns that application's
status and (if rejected) its rejection reason, but only after password
verification. Incorrect credentials still receive the same `401` response.
The successful-login response remains limited to active accounts.

Other inactive accounts return:

```text
403 Account is not active
```

The signed HS256 JWT contains:

- `user_id`
- `role`
- standard `iat`
- standard `exp`

### JWT Configuration

JWT configuration uses:

```env
JWT_SECRET=
JWT_EXPIRES_IN=1h
```

`JWT_SECRET` is required for token issuance and verification.

Never commit or log a real JWT secret or token.

### Current User

```http
GET /api/auth/me
```

Send:

```http
Authorization: Bearer <token>
```

A valid token returns the current safe user fields.

Missing, malformed, invalid, expired, or deleted-user tokens return:

```text
401 Authentication required
```

Each authenticated request reloads the user from MySQL.

An `INACTIVE` or `SUSPENDED` account returns:

```text
403 Account is not active
```

The current database role and account status are authoritative. Authentication does not trust the role stored in an older token over the current database value.

### Role-Based Authorization

Use `authorizeRoles` after `authenticate` on protected routes:

```js
router.get("/example", authenticate, authorizeRoles("ADMIN"), controller);
```

Supported roles:

- `PATIENT`
- `DOCTOR`
- `NGO`
- `ADMIN`

Authorization uses `req.user.role`, populated from the current database user.

An authenticated user without an allowed role receives:

```text
403 Forbidden
```

Resource ownership and other business-specific authorization rules are outside this middleware.

### Current Profile

```http
GET /api/profile
PATCH /api/profile
```

Both endpoints require an `ACTIVE` authenticated account. `GET /api/profile`
is available to `PATIENT`, `DOCTOR`, `NGO`, and `ADMIN` and returns the
authenticated user's own base profile plus the fields approved for that role.
It does not accept another user's ID.

`PATCH /api/profile` is available only to `PATIENT` and `DOCTOR`. Approved
fields are:

- Patient: `full_name`, `phone`, `date_of_birth`, `gender`, `address`
- Doctor: `full_name`, `phone`

Protected, unknown, or cross-role fields are rejected with `400`. Missing or
invalid authentication returns `401`; an inactive account or unauthorized role
returns `403`; and a missing role-specific profile returns `404`.

The Patient's own profile response includes the immutable `national_id`.

### Admin Join Request Review

All Admin Join Request endpoints require an `ACTIVE ADMIN` Bearer token:

```http
GET /api/admin/join-requests
GET /api/admin/join-requests/:id
PATCH /api/admin/join-requests/:id/approve
PATCH /api/admin/join-requests/:id/reject
```

The list endpoint returns pending requests only.

The details endpoint may return:

- `PENDING`
- `APPROVED`
- `REJECTED`

Approval atomically:

- marks a pending Doctor/NGO request as `APPROVED`
- records the reviewing Admin
- records `reviewed_at`
- clears `rejection_reason`
- activates the associated user

Rejection:

- requires a non-empty `rejection_reason`
- limits the reason to 500 characters
- marks the request as `REJECTED`
- records reviewer information
- keeps the associated user `INACTIVE`

Review transitions lock the Join Request row inside a Knex transaction so a pending request can only be reviewed once.

Expected errors include:

- `400` invalid input
- `401` unauthenticated
- `403` unauthorized role
- `404` Join Request not found
- `409` already reviewed or inconsistent request state

### Admin Doctor-Patient Assignments

All Doctor-Patient Assignment endpoints require an `ACTIVE ADMIN` Bearer token:

```http
GET /api/admin/doctor-patient-assignments
GET /api/admin/doctor-patient-assignments/:id
POST /api/admin/doctor-patient-assignments
PATCH /api/admin/doctor-patient-assignments/:id/status
```

The list endpoint returns current `ACTIVE` and historical `INACTIVE`
assignments in deterministic newest-first order. The details endpoint returns
one assignment by ID. Responses contain only fields from the approved
`doctor_patient_assignments` schema.

Creating an assignment requires `doctor_id`, `patient_id`, and a non-empty
`assignment_reason`; `notes` are optional. The referenced Doctor and Patient
profiles must exist and belong to active users with the matching roles. New
assignments are created as `ACTIVE` and return `201`.

The status endpoint accepts only `ACTIVE` or `INACTIVE`. Deactivation sets
`ended_at`; reactivation clears it and is rejected when another active
assignment already exists for the same doctor-patient pair. Requests that do
not change the current status are rejected.

Multiple historical `INACTIVE` assignments may exist for the same Doctor and
Patient, but at most one assignment may be `ACTIVE`. Creation and reactivation
enforce this rule transactionally without deleting historical rows.

Assignment endpoints return `400` for invalid input or IDs, `401` for missing
or invalid authentication, `403` for non-Admin access, `404` for missing
assignments or references, and `409` for conflicting status transitions,
inactive or inconsistent referenced accounts, or a duplicate active pair.

### Doctor Assigned-Patient Access

Doctor access to Patient-specific medical resources requires an `ACTIVE`
Doctor-Patient Assignment between the authenticated Doctor and the target
Patient. A missing or historical `INACTIVE` assignment does not authorize
access. The Doctor profile is resolved from the authenticated user, and the
target Patient is resolved from the route rather than trusted from a request
body.

This authorization rule is enforced by the implemented Doctor Medical Record,
Medical Note, Treatment Plan, Treatment Medication, and Treatment Appointment
routes documented below. Treatment Plans and their Medications and
Appointments support continuing care: a currently assigned Doctor may access
and manage them even when the Treatment Plan was created by a previous Doctor.
The original Treatment Plan `doctor_id` remains unchanged.

Authenticated Doctors can list their currently assigned Patients and view an
assigned Patient's approved profile information:

```http
GET /api/doctor/patients
GET /api/doctor/patients/:patientId
```

Both endpoints require an `ACTIVE` authenticated account with the `DOCTOR`
role. The list endpoint returns only Patients who have an `ACTIVE` assignment
to the authenticated Doctor; Patients connected only by historical or
`INACTIVE` assignments are excluded. An empty result returns `200` with an
empty `patients` list.

The detail endpoint validates `patientId` as a positive identifier within the
unsigned `BIGINT` range and requires an `ACTIVE` assignment between the
authenticated Doctor and the requested Patient. An invalid ID returns `400`,
a missing Patient returns `404`, and a missing or `INACTIVE` assignment returns
`403`.

Assigned-Patient responses expose only the approved safe Patient profile
fields returned by the implementation: `id`, `full_name`, `email`, `phone`,
`role`, `account_status`, `date_of_birth`, `gender`, and `address`. Internal
fields such as `user_id` and `password_hash` are not returned.

### Medical Records

Authenticated Doctors can create, view, and update the Medical Record of an
actively assigned Patient:

```http
POST  /api/doctor/patients/:patientId/medical-record
GET   /api/doctor/patients/:patientId/medical-record
PATCH /api/doctor/patients/:patientId/medical-record
```

Approved Medical Record fields are `blood_type`, `allergies`,
`chronic_diseases`, `medical_history`, and `previous_surgeries`. The `id`,
`patient_id`, `created_at`, and `updated_at` fields are server-controlled.
Updates are partial and require at least one approved field.

Each Patient can have at most one Medical Record. Creation returns `201`; a
duplicate returns `409`. Missing Patients or Medical Records return `404`, and
Doctor access without an active assignment returns `403`. Medical Record
deletion is not exposed.

Patients have read-only access to their own Medical Record:

```http
GET /api/patient/medical-record
```

The Patient identity is derived from the authenticated account. A Patient
cannot select another Patient ID, and a missing own Medical Record returns
`404`.

### Medical Notes

Authenticated Doctors can create and list Medical Notes for an actively
assigned Patient who already has a Medical Record:

```http
POST /api/doctor/patients/:patientId/medical-notes
GET  /api/doctor/patients/:patientId/medical-notes
```

Creation accepts only a required, non-empty `note` string. The
`medical_record_id` and `doctor_id` are derived by the server; IDs and
timestamps cannot be client-controlled. A missing Patient or Medical Record
returns `404`, while a missing active assignment returns `403`.

Medical Notes are Doctor-owned. The list endpoint returns only notes created
by the authenticated Doctor for the target Patient's Medical Record. Notes
created by other Doctors are not returned, even if the current Doctor is now
actively assigned to the same Patient. An empty result is returned as `200`
with an empty `medical_notes` list. Sprint 6 exposes no Patient Medical Note
endpoint and no Medical Note update or deletion endpoint.

### Treatment Plans

Authenticated Doctors can create, list, view, and update Treatment Plans for
an actively assigned Patient:

```http
POST  /api/doctor/patients/:patientId/treatment-plans
GET   /api/doctor/patients/:patientId/treatment-plans
GET   /api/doctor/patients/:patientId/treatment-plans/:planId
PATCH /api/doctor/patients/:patientId/treatment-plans/:planId
```

Creation requires `title` and `start_date`. Optional
`general_instructions` and `end_date` may be `null`. New plans start as
`ACTIVE`; clients cannot set `status` during creation. Updates may change
`title`, `general_instructions`, `status`, `start_date`, and `end_date`, with
status restricted to `ACTIVE`, `COMPLETED`, or `CANCELLED`.

Dates use `YYYY-MM-DD`. When `end_date` is present, it must be on or after
`start_date`, including after partial updates. The `patient_id`, original
creator `doctor_id`, IDs, and timestamps are server-controlled. Treatment Plan
deletion is not exposed.

Treatment Plans are continuing-care resources. Any Doctor who currently has
an active assignment with the Patient can list, view, and update the Patient's
plans, including plans created by a previous Doctor, without changing the
stored original `doctor_id`.

Patients have read-only access to their own Treatment Plans:

```http
GET /api/patient/treatment-plans
GET /api/patient/treatment-plans/:planId
```

An empty list returns `200`. A missing plan, a plan belonging to another
Patient, or a Patient-scoped resource mismatch returns a safe `404` response.

### Treatment Medications

Authenticated Doctors can manage medications under a Treatment Plan:

```http
POST   /api/doctor/treatment-plans/:planId/medications
GET    /api/doctor/treatment-plans/:planId/medications
GET    /api/doctor/treatment-plans/:planId/medications/:medicationId
PATCH  /api/doctor/treatment-plans/:planId/medications/:medicationId
DELETE /api/doctor/treatment-plans/:planId/medications/:medicationId
```

The Doctor must have an `ACTIVE` assignment with the Patient who owns the
Treatment Plan. A currently assigned Doctor may manage medications on a plan
created by a previous Doctor. Medication detail, update, and deletion are
scoped to the Treatment Plan in the URL.

Patients have read-only access to medications under their own Treatment Plans:

```http
GET /api/patient/treatment-plans/:planId/medications
GET /api/patient/treatment-plans/:planId/medications/:medicationId
```

Creation requires `medication_name`, `dosage`, and `frequency`. Optional
`duration` and `instructions` fields may be `null`. Resource IDs and timestamps
are server-controlled, and the approved schema has no medication status field.

### Treatment Appointments

Authenticated Doctors can manage appointments under an authorized Treatment
Plan:

```http
POST   /api/doctor/treatment-plans/:planId/appointments
GET    /api/doctor/treatment-plans/:planId/appointments
GET    /api/doctor/treatment-plans/:planId/appointments/:appointmentId
PATCH  /api/doctor/treatment-plans/:planId/appointments/:appointmentId
DELETE /api/doctor/treatment-plans/:planId/appointments/:appointmentId
```

Doctor access requires an `ACTIVE` assignment with the Patient who owns the
plan. Continuing-care access permits the current assigned Doctor to manage
appointments on a plan created by a previous Doctor.

Patients can only list and view appointments under their own Treatment Plans:

```http
GET /api/patient/treatment-plans/:planId/appointments
GET /api/patient/treatment-plans/:planId/appointments/:appointmentId
```

Creation requires `appointment_date` in `YYYY-MM-DD HH:mm:ss` format and a
non-empty `purpose`. The appointment calendar date must fall within the plan's
inclusive date range; a null plan `end_date` has no upper bound. New
appointments start as `SCHEDULED`, while updates may use `SCHEDULED`,
`COMPLETED`, or `CANCELLED` without additional transition restrictions.

## Admin Seed

The Admin seed creates an `ACTIVE` Admin account without creating a Patient, Doctor, NGO profile, or Join Request.

Environment variables:

```env
ADMIN_EMAIL=admin@hcms.local
ADMIN_PASSWORD=
```

`ADMIN_EMAIL` may use the default local Admin email.

`ADMIN_PASSWORD` is required and must not have a hard-coded fallback.

Run:

```bash
npm run seed
```

The seed is idempotent and does not create duplicate Admin users.

## API Response Format

Successful responses use:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Validation errors use:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {}
}
```

Other API errors return:

```json
{
  "success": false,
  "message": "..."
}
```

Sensitive values such as password hashes and JWT secrets are never returned in API responses.

## Project Structure

```text
HCMS-Backend/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── app.js
│   └── server.js
│
├── .env.example
├── .gitignore
├── knexfile.js
├── package.json
└── README.md
```

## Branching

- `main` — stable version
- `develop` — development integration branch
- `feature/...` — individual feature branches

New development work should not be committed directly to `main`.

Typical workflow:

```text
develop → feature/... → develop → main
```
