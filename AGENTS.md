# HCMS Backend — Codex Instructions

## Project Overview

HCMS (Healthcare Conflict Management System) is a web-based healthcare
management platform designed to support healthcare coordination and
humanitarian assistance in conflict-affected environments.

The system supports four user roles:

- Patient
- Doctor
- NGO
- Administrator

The backend exposes a RESTful API consumed by the HCMS frontend.

---

## Technology Stack

- Node.js
- Express.js
- MySQL
- Knex.js
- mysql2
- JWT authentication

Do not introduce new frameworks, ORMs, databases, or major dependencies
without explicit approval.

---

## Architecture

Maintain the existing backend structure and separation of concerns.

Expected structure:

src/

- config/
- controllers/
- middleware/
- models/
- routes/
- services/
- utils/

database/

- migrations/
- seeds/

Routes should define API endpoints.

Controllers should handle HTTP request and response flow.

Services should contain business logic when appropriate.

Database access should remain separated from route definitions.

Middleware should handle cross-cutting concerns such as authentication,
authorization, validation, and error handling.

Do not perform major architectural refactoring unless explicitly requested.

---

## API Rules

The backend must expose RESTful APIs.

Use JSON for API requests and responses.

Do not change an existing API contract without explicit approval.

Keep response formats consistent.

Protected resources must verify authentication and authorization.

Role-specific endpoints must enforce RBAC on the backend.

Do not rely only on frontend restrictions for security.

---

## Authentication and Authorization

Authentication uses JWT.

Passwords must never be stored in plain text.

Passwords must be securely hashed before storage.

The system has four roles:

- PATIENT
- DOCTOR
- NGO
- ADMIN

A user has only one system role.

Doctor and NGO accounts must not become active before Administrator approval.

Patient accounts do not require a Join Request.

Do not change authentication, authorization, approval workflows, token
handling, or password handling without explicit approval.

---

## Database Rules

MySQL is the project database.

Knex.js is used for migrations and database access.

Database structure must follow the approved HCMS ERD and Data Dictionary.

Do not:

- add tables
- remove tables
- rename tables
- add or remove relationships
- modify foreign keys
- change constraints
- change enum values

unless the task explicitly requires it and the change has been approved.

Never invent database fields based only on implementation convenience.

Database migrations should be small, focused, and reversible when practical.

---

## Important Business Rules

The following rules must be preserved.

### Doctor-Patient Assignments

Multiple historical assignments may exist for the same doctor and patient.

Only one ACTIVE assignment may exist for the same doctor-patient pair at
the same time.

Assignments may contain:

- assignment_reason
- notes

Do not add a UNIQUE constraint on `(doctor_id, patient_id)`.

### Join Requests

Only Doctor and NGO users require Join Requests.

A user may have only one PENDING Join Request at a time.

Doctor and NGO accounts require Administrator approval before activation.

Patients do not require Join Requests.

### Messaging

Messaging is allowed only between a Patient and a Doctor who has an ACTIVE
Doctor-Patient Assignment with that patient.

This rule must be enforced by the backend.

### Emergency Alerts

Patients may create Emergency Alerts.

Emergency Alerts are monitored and assigned through the Administrator flow.

An Emergency Alert may only be assigned to a Doctor whose specialization is:

- General Medicine
- Emergency Medicine

Do not change this workflow without explicit approval.

### Treatment Plans

If a treatment plan has an end date:

end_date >= start_date

### Resource Allocations

Resource allocation quantity must be greater than zero.

### Polymorphic References

The following fields are not direct database foreign keys:

notifications:

- reference_type
- reference_id

reminders:

- reference_type
- reference_id

activity_logs:

- entity_type
- entity_id

Their validity must be checked in backend logic where required.

---

## Security Rules

Always enforce authorization on the backend.

Patients may access only their own personal and medical information.

Doctors may access only information belonging to their assigned patients.

NGOs may manage only assistance requests assigned to their organization.

Administrative functionality must be restricted to Administrators.

Do not expose password hashes, tokens, or sensitive internal information in
API responses.

Do not commit secrets or `.env` files.

---

## Development Workflow

Work on small and focused tasks.

Before implementing a large or cross-cutting task, inspect the relevant
code and produce a plan first.

Do not modify unrelated files.

Do not perform cleanup, refactoring, formatting changes, or dependency
upgrades unless they are required for the task.

Preserve existing working behavior unless the task explicitly changes it.

---

## Testing and Verification

After implementation:

1. Run the relevant tests if tests exist.
2. Run relevant validation or lint commands when applicable.
3. Report exactly which commands were executed.
4. Report their actual results.

Never claim that a test passed if it was not executed.

If a test cannot be run, state that clearly.

For database changes, verify migration behavior where applicable.

---

## Git Rules

Do not create commits unless explicitly requested.

Do not push changes unless explicitly requested.

Do not merge branches.

Do not force-push.

Before suggesting a commit, review:

- git status
- git diff

Changes should remain small and focused.

---

## Documentation and External Libraries

Detailed backend API documentation must be maintained in:

- `docs/api/README.md`

Update that document as backend endpoints evolve. Document only behavior that
has been verified against the authoritative project references, approved
decisions, and current implementation.

When implementation depends on current framework or library behavior,
prefer current official documentation.

When Context7 MCP is available, use it for current library/framework
documentation when needed instead of relying only on memory.

Do not change dependency versions unless required and approved.

---

## Source of Truth

The following maintained Markdown files are the current project references for
HCMS backend requirements and database design:

- `docs/requirements/SRS.md`
- `docs/requirements/PATIENT_INTAKE_AND_CARE_COORDINATION.md`
- `docs/database/ERD.md`
- `docs/database/Data-Dictionary.md`
- `docs/api/README.md` for current API contracts
- Approved project decisions

Review the relevant sections of these documents before implementing or
auditing backend requirements. Do not rely only on memory, README content,
GitHub issue text, or the current implementation when an approved reference is
available.

If the authoritative documents, current code, root README, detailed API
documentation, or GitHub issues conflict, stop and report the inconsistency.
Do not silently choose one behavior, change the implementation, or rewrite the
documentation without explicit resolution.

If requirements are ambiguous, ask for clarification before making
high-impact changes.
