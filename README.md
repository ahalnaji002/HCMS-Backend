# Healthcare Conflict Management System — Backend

REST API for the **Healthcare Conflict Management System (HCMS)**, a healthcare coordination platform connecting patients, doctors, non-governmental organizations (NGOs), and administrators.

Built with **Node.js, Express.js, MySQL, and Knex.js**, this repository contains the backend application, database migrations, automated tests, and API documentation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [API Documentation](#api-documentation)
- [Getting Started](#getting-started)
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
| Automated testing | Node.js test runner, Supertest |
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
```

Configure the additional `TEST_DB_*` values from `.env.example` before running tests. Do not commit real secrets, passwords, tokens, or your local `.env` file.

### 4. Prepare the development database

Create the configured development database if it does not exist:

```sql
CREATE DATABASE hcms_db;
```

Apply migrations:

```bash
npm run migrate
```

Run seeds when required by your local setup:

```bash
npm run seed
```

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

Backend automated tests do not, by themselves, establish that complete frontend user journeys have been tested end to end.

## Project Structure

A concise view of the main directories and entry points:

```text
HCMS-Backend/
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   ├── api/
│   └── requirements/
├── scripts/
│   └── runIsolatedTests.js
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── workers/
│   │   └── reminderWorker.js
│   ├── app.js
│   └── server.js
├── test/
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
