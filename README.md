# Healthcare Conflict Management System — Backend

[![Backend CI](https://github.com/ahalnaji002/HCMS-Backend/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/ahalnaji002/HCMS-Backend/actions/workflows/ci.yml)

REST API for the **Healthcare Conflict Management System (HCMS)**, a healthcare coordination platform connecting patients, doctors, non-governmental organizations (NGOs), and administrators.

Built with **Node.js, Express.js, MySQL, and Knex.js**, this repository contains the backend application, database migrations, automated tests, and API documentation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [API Documentation](#api-documentation)
- [Getting Started](#getting-started)
- [Demo Data](#demo-data)
- [Testing & Quality](#testing--quality)
- [Project Structure](#project-structure)
- [Related Repository](#related-repository)

## Overview

HCMS coordinates healthcare workflows across four application roles:

| Role | Main responsibilities |
| --- | --- |
| Patient | Submit and review health intake, access authorized medical information, and follow care and assistance requests |
| Doctor | Work with assigned patients, maintain medical records and treatment plans, and request assistance |
| NGO | Review assigned assistance requests and manage resource allocations |
| Admin | Review applications and patient intakes, coordinate doctor assignments, and oversee administrative workflows |

Access is controlled through authentication, role-based permissions, and resource-specific authorization rules.

## Features

- **Identity and access:** Patient, Doctor, and NGO registration; JWT login; role-based authorization; join-request approval and rejection; role-specific profiles.
- **Patient intake and coordination:** Self-reported intake, administrative review and correction requests, doctor availability and workload information, doctor–patient assignments, and per-doctor diagnoses.
- **Clinical workflows:** Medical records, doctor-owned medical notes, treatment plans, medications, and appointments with role-appropriate access.
- **Assistance and emergencies:** Emergency alerts, NGO assistance requests, and resource allocations.
- **Communication:** Patient–Doctor messaging, notifications, and patient reminders.
- **Administration:** Dashboards, basic reports, activity logs, and system settings.
- **Security and reliability:** Rate limiting on the public emergency alert, login, and registration endpoints; helmet security headers; CORS restricted to configured frontend origins; centralized error handling; startup stops with a clear message when the database is unreachable.

Detailed behavior, validation rules, and authorization constraints are documented in the [API reference](docs/api/README.md) and relevant [requirements](docs/requirements/PATIENT_INTAKE_AND_CARE_COORDINATION.md).

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| HTTP framework | Express.js 5 |
| Database | MySQL |
| Query builder and migrations | Knex.js, mysql2 |
| Authentication | JSON Web Tokens (JWT), bcryptjs |
| API documentation | OpenAPI 3, Swagger UI |
| Security | helmet, express-rate-limit, CORS |
| Automated testing | Node.js test runner, Supertest, built-in coverage |
| Continuous integration | GitHub Actions (tests, coverage, dependency audit) |
| Development | Nodemon, dotenv |

## System Architecture

The backend uses a **layered Express application structure**. Routes and middleware handle request routing, authentication, authorization, and validation. Controllers handle HTTP input and output; services coordinate business workflows where applicable; models and data-access modules use Knex to work with MySQL.

```text
Client
  |
  v
Express app (src/app.js)
  |
  v
Routes and middleware
  |
  v
Controllers
  |
  +--> Services (where applicable)
  |       |
  |       v
  +----> Models / data access
              |
              v
          Knex.js
              |
              v
            MySQL
```

This is a **general responsibility map**, not a requirement that every endpoint passes through every layer. Selected multi-step workflows use Knex transactions to maintain consistency. A reminder worker is also started by the server outside the ordinary HTTP request flow.

Key security mechanisms include password hashing, JWT verification, role checks, resource ownership checks, and active doctor–patient assignment requirements for protected clinical operations.

Errors are handled centrally: service errors extend `ApiError` subclasses in `src/utils/apiErrors.js` and carry their HTTP status, and `apiErrorHandler` turns them into the standard `{ success: false, message }` response. Controllers contain only the success path (Express 5 forwards async errors).

## API Documentation

- **Interactive Swagger UI:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (when the backend is running locally)
- **Detailed endpoint and workflow reference:** [docs/api/README.md](docs/api/README.md)
- **Frontend integration guide:** [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)
- **Patient intake and care coordination requirements:** [docs/requirements/PATIENT_INTAKE_AND_CARE_COORDINATION.md](docs/requirements/PATIENT_INTAKE_AND_CARE_COORDINATION.md)

### Main API Groups

| Area | Base path |
| --- | --- |
| Authentication | `/api/auth` |
| Profiles | `/api/profile` |
| Administration | `/api/admin` |
| Patients | `/api/patient` |
| Doctors | `/api/doctor` |
| NGOs | `/api/ngo` |
| Emergency alerts | `/api/emergency-alerts` |
| Messaging | `/api/messages` |
| Notifications | `/api/notifications` |

Consult the detailed API reference for request bodies, responses, access rules, and endpoint-specific restrictions.

## Getting Started

### Prerequisites

- Node.js and npm
- MySQL
- Git

### 1. Clone and select the development branch

```bash
git clone https://github.com/ahalnaji002/HCMS-Backend.git
cd HCMS-Backend
git checkout develop
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

Create a local `.env` file using [`.env.example`](.env.example) as a reference. Typical development values include:

```dotenv
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hcms_db

JWT_SECRET=replace_with_a_strong_private_secret
JWT_EXPIRES_IN=1h

ADMIN_EMAIL=admin@hcms.local
ADMIN_PASSWORD=replace_with_a_private_password

# Comma-separated frontend origins allowed by CORS (empty = local dev origins)
CORS_ORIGIN=
# Reverse-proxy hop count in production, so rate limits use the client IP
TRUST_PROXY=
```

Configure the additional `TEST_DB_*` values from `.env.example` before running tests. Rate limits can be tuned with the optional `RATE_LIMIT_*` variables (see the [API reference](docs/api/README.md#rate-limiting-and-http-security)). Do not commit real secrets, passwords, tokens, or your local `.env` file.

### 4. Prepare the development database

Create the configured development database if it does not exist:

```sql
CREATE DATABASE hcms_db;
```

Apply migrations:

```bash
npm run migrate
```

Run seeds when required by your local setup (creates the administrator and system settings):

```bash
npm run seed
```

For realistic demo data, see [Demo Data](#demo-data).

**Database safety:** Check your `DB_*` connection settings before running migrations or seeds. These commands operate on the configured development database.

### 5. Start the server

```bash
npm run dev
```

Or use:

```bash
npm start
```

The API listens on `http://localhost:3000` by default.

## Demo Data

For presentations, the demo video, and local manual testing, load realistic demo data after the administrator seed:

```bash
npm run seed
npm run seed:demo
```

The script creates every record **through the real API** (running in-process on a local port), so all validation, authorization, and business rules apply, and notifications and activity logs are produced by the services. Dates are relative to the day the script runs, so appointments always include past and upcoming ones.

All demo accounts use the password `Demo@2026` and the `@demo.hcms.test` email domain:

| Role | Accounts | What they show |
| --- | --- | --- |
| Doctor | `dr.khaled`, `dr.sara`, `dr.mohammad`, `dr.reem`, `dr.yousef` | General, Emergency, Orthopedics, Rehabilitation; Dr. Khaled at capacity, Dr. Yousef unavailable |
| Doctor applicants | `dr.ahmad` (pending), `dr.nour` (rejected with reason) | Join-request review and applicant status on login |
| NGO | `ngo.amal`, `ngo.shifa`; `ngo.sanad` (pending) | Assistance review, approval, and resource allocation |
| Patient | `mahmoud`, `fatima`, `layla`, `omar`, `heba`, `sami`, `asmaa`, `rami` | Intakes in every state, multi-doctor care, treatment plans, reminders, messages |

Covered states: emergency alerts (pending, assigned, in progress, resolved, cancelled; public and patient), assistance requests (pending, under review, approved, rejected, completed), intakes (submitted, under review, doctor assigned), and intake correction requests (open and resolved).

The script refuses to run twice on the same database and refuses `NODE_ENV=production` unless `HCMS_ALLOW_DEMO_SEED=1` is set. To start again, recreate the database, then run `npm run migrate`, `npm run seed`, and `npm run seed:demo`.

## Testing & Quality

The automated suite is started with:

```bash
npm test
```

The `test` script runs `scripts/runIsolatedTests.js`, which creates a uniquely named **temporary MySQL schema**, applies migrations, executes tests, and removes only that temporary schema afterward.

Important safeguards:

- `TEST_DB_NAME` must be `hcms_test_db` and must differ from `DB_NAME`.
- The isolated test runner permits only a local test database host.
- The test MySQL account needs permissions to create and drop the temporary schema.
- Do not point test settings at a shared or development database.

Test layout:

- `test/integration/*.test.js` — API integration tests, one file per module (assignments, treatment plans, emergency alerts, assistance requests, messaging, and so on). Files run one at a time because they share the temporary schema.
- `test/helpers/integrationHarness.js` — shared fixtures, database safety checks, and the per-file lifecycle hooks (`registerIntegrationHooks()`).
- `test/*.test.js` — unit and contract tests that need no database (validators, Swagger contract, error handling, security middleware).

Run one file with `npm test -- test/integration/12-emergency-alerts.test.js`.

Coverage: `npm run test:coverage` prints line, branch, and function coverage for `src/` using the Node.js built-in test coverage.

Continuous integration: every push and pull request to `develop` or `main` runs the full suite with coverage against a MySQL service container, plus a production dependency audit (`.github/workflows/ci.yml`).

Backend automated tests do not, by themselves, establish that complete frontend user journeys have been tested end to end.

## Project Structure

A concise view of the main directories and entry points:

```text
HCMS-Backend/
├── .github/
│   └── workflows/ci.yml
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   ├── api/
│   └── requirements/
├── scripts/
│   ├── runIsolatedTests.js
│   └── seedDemoData.js
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── workers/
│   │   └── reminderWorker.js
│   ├── app.js
│   └── server.js
├── test/
│   ├── helpers/
│   └── integration/
├── .env.example
├── knexfile.js
├── package.json
├── FRONTEND_INTEGRATION.md
└── README.md
```

This tree highlights the main components; it is not an exhaustive file listing.

## Related Repository

The React-based client is maintained separately:

**[HCMS Frontend](https://github.com/ahalnaji002/HCMS-Frontend)**

---

Developed collaboratively as a Computer Engineering graduation project.
