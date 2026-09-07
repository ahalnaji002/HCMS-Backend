# HCMS Backend

## Project Overview

Backend API for the Healthcare Conflict Management System (HCMS).

## Features

- Express-based REST API foundation.
- Reusable Knex runtime database connection.
- Dependency-ordered Knex migrations for the approved 19-table HCMS schema.
- Initial data-access modules for users, patient profiles, doctor profiles, NGO profiles, and Join Requests.
- Transactional Patient Registration with bcrypt password hashing.

## Setup

Copy .env.example to .env and configure the MySQL connection values, then install dependencies:

    npm install

Apply all pending database migrations:

    npm run migrate

Roll back the latest migration batch:

    npm run migrate:rollback

Start the development server:

    npm run dev

## Database Access

Application queries use the shared Knex instance in src/config/database.js. Model methods accept an optional Knex transaction as their final argument so service-layer workflows can compose related writes atomically.

## API

### Patient Registration

    POST /api/auth/register/patient

Required JSON fields: full_name, email, password, date_of_birth, and gender.

Optional JSON fields: phone and address.

Patient registration creates the user and patient profile in one transaction. The server assigns role PATIENT and account status ACTIVE. It does not create a Join Request or return a token.

The date_of_birth response field is serialized as a date-only YYYY-MM-DD string. Timestamp fields remain timestamps.

Successful responses use success true with message and data fields. Validation responses use success false with message Validation failed and a field-keyed errors object. Other API errors use success false with a safe message.

### Doctor Registration

    POST /api/auth/register/doctor

Required JSON fields: full_name, email, password, specialization, and license_number.

The optional JSON field is phone.

Doctor registration creates the user, doctor profile, and pending Join Request in one transaction. The server assigns role DOCTOR, account status INACTIVE, request type DOCTOR, and request status PENDING. It does not return a token.
### NGO Registration

    POST /api/auth/register/ngo

Required JSON fields: full_name, email, password, password_confirmation, and organization_name.

Optional JSON fields: registration_number, phone, and address.

NGO registration creates the user, NGO profile, and pending Join Request in one transaction. The server assigns role NGO, account status INACTIVE, request type NGO, and request status PENDING. The request phone is stored in the approved NGO contact_phone field. It does not return a token.

### Login

    POST /api/auth/login

Required JSON fields: email and password. Email is trimmed; password is compared unchanged using async bcrypt.compare. Login does not require password_confirmation or reapply registration password complexity.

Valid credentials for ACTIVE accounts return HTTP 200 with safe user fields. Incorrect credentials return HTTP 401 with Invalid email or password. Valid credentials for non-active accounts return HTTP 403 with Account is not active.

Successful login returns data.user and data.token. The signed HS256 JWT contains only user_id and role plus standard iat/exp claims. Invalid credentials and non-active accounts receive no token.

### JWT Configuration

Set JWT_SECRET to a strong private random value in your local environment and JWT_EXPIRES_IN to 1h. Both values are required for token issuance; JWT_SECRET is also required for verification. The blank JWT_SECRET in .env.example is a placeholder and must be configured locally. Never commit or log a real secret or token.

### Current User

    GET /api/auth/me

Send Authorization: Bearer <token>. A valid token returns HTTP 200 with the current safe user fields only, without tokens or role-specific profiles.

Missing, malformed, invalid, expired, or deleted-user tokens return HTTP 401 with Authentication required. Each authenticated request reloads the user from MySQL: an INACTIVE or SUSPENDED account returns HTTP 403 with Account is not active. req.user uses the current database role rather than trusting the token role.

JWT authentication does not implement refresh tokens or token persistence. Role checks use the reusable RBAC middleware, and the Admin Join Request workflow is documented below.

### Role-Based Authorization

Use authorizeRoles after authenticate on protected routes:

    router.get("/example", authenticate, authorizeRoles("ADMIN"), controller);

It accepts one or more approved roles: PATIENT, DOCTOR, NGO, and ADMIN. It authorizes using req.user.role, which authenticate reloads from MySQL. An authenticated user without an allowed role receives HTTP 403 Forbidden. Resource ownership and other business authorization rules are outside this middleware.

### Admin Join Request Review

All Admin Join Request endpoints require an ACTIVE ADMIN Bearer token:

    GET /api/admin/join-requests
    GET /api/admin/join-requests/:id
    PATCH /api/admin/join-requests/:id/approve
    PATCH /api/admin/join-requests/:id/reject

The list returns pending requests only; details may return any review status. Approval atomically marks a pending Doctor/NGO request APPROVED and activates its user. Rejection requires a non-empty rejection_reason of at most 500 characters, marks the request REJECTED, and keeps the user INACTIVE.

Review transitions lock the Join Request row in a Knex transaction so a pending request can be reviewed only once. Invalid identifiers return 400, missing requests 404, previously reviewed or inconsistent requests 409, unauthenticated requests 401, and non-Admin requests 403.

## Dependencies

- Express.js
- MySQL2
- Knex.js
- bcryptjs
- jsonwebtoken
- CORS
- dotenv
