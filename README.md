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

The project includes dependency-ordered Knex migrations for the approved 19-table HCMS schema.

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
- Dependency-ordered migrations for the approved 19-table HCMS schema.
- Data-access modules for users, patients, doctors, NGOs, and Join Requests.
- Transactional Patient Registration.
- Transactional Doctor Registration with Join Request creation.
- Transactional NGO Registration with Join Request creation.
- bcrypt password hashing.
- Login with JWT authentication.
- Current-user authentication middleware.
- Role-Based Access Control (RBAC).
- Admin Join Request approval and rejection workflow.
- Transactional and concurrency-safe Join Request reviews.
- Admin creation and viewing of current and historical Doctor-Patient Assignments.
- Transactional Doctor-Patient Assignment status transitions.

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

Valid credentials for an `INACTIVE` or `SUSPENDED` account return:

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

The status endpoint accepts only `ACTIVE` or `INACTIVE`. Deactivation sets
`ended_at`; reactivation clears it and is rejected when another active
assignment already exists for the same doctor-patient pair. Requests that do
not change the current status are rejected.

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
