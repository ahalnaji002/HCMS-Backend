# HCMS — Frontend Integration Guide

> Frontend / Backend integration reference for the current HCMS implementation.
>
> **Important:** `docs/api/README.md` remains the detailed backend API reference. This file is a frontend-oriented working guide.

### Current authenticated user

```http
GET /api/auth/me
```

Returns the currently authenticated user context. Send the JWT in the `Authorization: Bearer <token>` header.

---

## 1. Base Integration Rules

- Protected endpoints require the JWT issued by login.
- Send the JWT as:

```http
Authorization: Bearer <token>
```

- Supported roles: `PATIENT`, `DOCTOR`, `NGO`, `ADMIN`.
- Do not send ownership fields when the backend derives them from the authenticated user, URL, or database relationship.
- Patients may access only their own personal/medical information.
- Doctors may access patient-specific medical information only when an `ACTIVE` Doctor–Patient Assignment exists.
- Doctor–Patient Assignment management is `ADMIN` only.
- Never expose or depend on internal fields such as `password_hash`.

### Standard response shapes

Success:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Validation error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {}
}
```

Other API error:

```json
{
  "success": false,
  "message": "..."
}
```

Common status codes:

| Status | Meaning |
|---|---|
| `200` | Successful read/update |
| `201` | Successful creation |
| `400` | Invalid request / validation |
| `401` | Authentication required |
| `403` | Authenticated but not authorized, or valid login credentials for an inactive account |
| `404` | Resource not found |
| `409` | Business-rule/uniqueness conflict |

---

## 2. Authentication & Registration

### Login

```http
POST /api/auth/login
```

Active accounts receive a JWT for protected requests. Doctor and NGO applicants
whose accounts remain inactive receive `403` and no JWT after valid credentials
are verified. When their latest Join Request is `PENDING` or `REJECTED`, the
response includes `data.application` with `request_type`, `status`,
`rejection_reason`, `submitted_at`, and `reviewed_at`. Invalid credentials
continue to return the generic `401` response and never disclose application
status. Applicant status access does not grant protected account access or
enable application updates/resubmission.

The current backend uses stateless JWT authentication. The configured token lifetime is environment-controlled; current development configuration is `1h`.

### Logout

There is **no server-side logout/revocation endpoint** in the current release.

Frontend logout must:

1. Remove the locally stored JWT.
2. Clear local authentication/user state.
3. Redirect the user to the login/public area as appropriate.

Do not tell the user that the token was revoked server-side.

### Patient registration

```http
POST /api/auth/register/patient
```

Patient registration requires `national_id`.

National ID rules:

- Patient only.
- Required.
- Exactly 9 digits.
- First digit must not be `0`.
- Unique.
- Treat it as a string.

Example of the patient-specific field:

```json
{
  "national_id": "123456789"
}
```

The frontend should surface backend validation errors rather than duplicating business assumptions.

### Doctor registration

```http
POST /api/auth/register/doctor
```

Doctor registration does **not** use `national_id`.

Doctors have professional identity data such as `specialization` and `license_number`. A newly registered Doctor requires administrative approval before activation.

### NGO registration

```http
POST /api/auth/register/ngo
```

NGO registration does **not** use `national_id`.

A newly registered NGO requires administrative approval before activation.

### Password reset

Password recovery/reset is **outside the current release scope**.

Do not build or connect:

- Forgot Password page/API flow.
- Reset Password page/API flow.
- Email/SMS verification flow.

---

## 3. Own Profile

### View own profile

```http
GET /api/profile
```

Protected endpoint.

The authenticated user's identity comes from the JWT/authentication middleware; the client does not provide a target user ID.

Patient profile includes safe patient/user fields and the patient's own `national_id`.

Doctor profile includes safe user/doctor fields such as `specialization` and `license_number`.

NGO/Admin profiles expose only their applicable safe profile fields.

### Update own profile

```http
PATCH /api/profile
```

Protected endpoint.

Patient editable fields:

- `full_name`
- `phone`
- `date_of_birth`
- `gender`
- `address`

Doctor editable fields:

- `full_name`
- `phone`

Protected/non-self-editable fields include:

- `id`
- `user_id`
- `email`
- `password_hash`
- `role`
- `account_status`
- `national_id`
- `specialization`
- `license_number`
- `created_at`
- `updated_at`

`national_id` is not editable through normal profile update.

---

## 4. Doctor — Assigned Patients

### List currently assigned patients

```http
GET /api/doctor/patients
```

Role: `DOCTOR`

Returns patients with an `ACTIVE` Doctor–Patient Assignment for the authenticated Doctor.

Inactive/historical assignments do not grant patient access.

### View assigned patient

```http
GET /api/doctor/patients/:patientId
```

Role: `DOCTOR`

Requires an `ACTIVE` assignment.

The patient's `national_id` must not be expected in Doctor assigned-patient responses.

---

## 5. Admin — Doctor–Patient Assignments

### Create assignment

```http
POST /api/admin/doctor-patient-assignments
```

Role: `ADMIN`

Request:

```json
{
  "doctor_id": 1,
  "patient_id": 1,
  "assignment_reason": "...",
  "notes": "..."
}
```

`assignment_reason` is required and `notes` are optional.

The backend creates the assignment as `ACTIVE`.

Business rule: multiple historical assignments may exist for the same Doctor–Patient pair, but only one may be `ACTIVE` at a time.

### List assignment history

```http
GET /api/admin/doctor-patient-assignments
```

Role: `ADMIN`

### View assignment

```http
GET /api/admin/doctor-patient-assignments/:id
```

Role: `ADMIN`

### Update assignment status

```http
PATCH /api/admin/doctor-patient-assignments/:id/status
```

Role: `ADMIN`

Statuses:

- `ACTIVE`
- `INACTIVE`

Ending an assignment preserves its history and records `ended_at`.

---

## 6. Medical Records

Approved fields:

- `blood_type`
- `allergies`
- `chronic_diseases`
- `medical_history`
- `previous_surgeries`

### Patient — view own medical record

```http
GET /api/patient/medical-record
```

Role: `PATIENT`

The patient ID is derived from the authenticated account.

### Doctor — create assigned patient's medical record

```http
POST /api/doctor/patients/:patientId/medical-record
```

Role: `DOCTOR`

Requires an `ACTIVE` assignment.

Example:

```json
{
  "blood_type": "A+",
  "allergies": "Penicillin",
  "chronic_diseases": "Asthma",
  "medical_history": "Previous respiratory treatment",
  "previous_surgeries": null
}
```

A Patient may have at most one Medical Record. A duplicate record results in a conflict.

### Doctor — view assigned patient's medical record

```http
GET /api/doctor/patients/:patientId/medical-record
```

Role: `DOCTOR`

Requires an `ACTIVE` assignment.

### Doctor — update assigned patient's medical record

```http
PATCH /api/doctor/patients/:patientId/medical-record
```

Role: `DOCTOR`

Partial update. Requires an `ACTIVE` assignment.

Do not send server-controlled fields such as `id`, `patient_id`, `created_at`, or `updated_at`.

There is no Medical Record deletion endpoint in the current Sprint 6 API.

---

## 7. Medical Notes

### View notes

```http
GET /api/doctor/patients/:patientId/medical-notes
```

Role: `DOCTOR`

Requires an `ACTIVE` assignment.

### Create note

```http
POST /api/doctor/patients/:patientId/medical-notes
```

Role: `DOCTOR`

Request:

```json
{
  "note": "..."
}
```

The backend derives `doctor_id` and `medical_record_id`. Do not send them as ownership fields.

---

## 8. Treatment Plans

### Patient — list own plans

```http
GET /api/patient/treatment-plans
```

Role: `PATIENT`

### Patient — view own plan

```http
GET /api/patient/treatment-plans/:planId
```

Role: `PATIENT`

### Doctor — list assigned patient's plans

```http
GET /api/doctor/patients/:patientId/treatment-plans
```

Role: `DOCTOR`

Requires an `ACTIVE` assignment.

### Doctor — create plan

```http
POST /api/doctor/patients/:patientId/treatment-plans
```

Role: `DOCTOR`

Example:

```json
{
  "title": "...",
  "general_instructions": "...",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD"
}
```

`general_instructions` and `end_date` are optional.

Default status: `ACTIVE`.

If `end_date` is provided:

```text
end_date >= start_date
```

The backend derives `patient_id` and `doctor_id`.

### Doctor — view plan

```http
GET /api/doctor/patients/:patientId/treatment-plans/:planId
```

Role: `DOCTOR`

Requires an active assignment with the plan's Patient.

### Doctor — update plan

```http
PATCH /api/doctor/patients/:patientId/treatment-plans/:planId
```

Role: `DOCTOR`

Statuses:

- `ACTIVE`
- `COMPLETED`
- `CANCELLED`

The date rule must remain valid after updates.

---

## 9. Treatment Medications

Medication operations are scoped to an authorized Treatment Plan.

### Doctor — list medications

```http
GET /api/doctor/treatment-plans/:planId/medications
```

### Doctor — view medication

```http
GET /api/doctor/treatment-plans/:planId/medications/:medicationId
```

### Doctor — add medication

```http
POST /api/doctor/treatment-plans/:planId/medications
```

### Doctor — update medication

```http
PATCH /api/doctor/treatment-plans/:planId/medications/:medicationId
```

### Doctor — delete medication

```http
DELETE /api/doctor/treatment-plans/:planId/medications/:medicationId
```

Role: `DOCTOR`

Doctor medication access requires an authorized Treatment Plan and an `ACTIVE` Doctor–Patient Assignment.

Fields:

- `medication_name` — required
- `dosage` — required
- `frequency` — required
- `duration` — optional
- `instructions` — optional

When viewing, updating, or deleting a Medication, it must belong to `:planId`.

### Patient — list medications for own plan

```http
GET /api/patient/treatment-plans/:planId/medications
```

### Patient — view medication for own plan

```http
GET /api/patient/treatment-plans/:planId/medications/:medicationId
```

Role: `PATIENT`

Patients have read-only access and may access medications only through their own Treatment Plans.

---

## 10. Treatment Appointments

Appointment operations are scoped to an authorized Treatment Plan.

### Doctor — list appointments

```http
GET /api/doctor/treatment-plans/:planId/appointments
```

### Doctor — view appointment

```http
GET /api/doctor/treatment-plans/:planId/appointments/:appointmentId
```

### Doctor — add appointment

```http
POST /api/doctor/treatment-plans/:planId/appointments
```

### Doctor — update appointment

```http
PATCH /api/doctor/treatment-plans/:planId/appointments/:appointmentId
```

### Doctor — delete appointment

```http
DELETE /api/doctor/treatment-plans/:planId/appointments/:appointmentId
```

Role: `DOCTOR`

Doctor appointment access requires an authorized Treatment Plan and an `ACTIVE` Doctor–Patient Assignment.

Fields:

- `appointment_date` — required
- `purpose` — required
- `location` — optional
- `status`
- `notes` — optional

Statuses:

- `SCHEDULED`
- `COMPLETED`
- `CANCELLED`

Default status: `SCHEDULED`.

When viewing, updating, or deleting an Appointment, it must belong to `:planId`.

### Patient — list appointments for own plan

```http
GET /api/patient/treatment-plans/:planId/appointments
```

### Patient — view appointment for own plan

```http
GET /api/patient/treatment-plans/:planId/appointments/:appointmentId
```

Role: `PATIENT`

Patients have read-only access and may access appointments only through their own Treatment Plans.

---

## 11. Frontend Authorization Matrix

| Feature | PATIENT | DOCTOR | NGO | ADMIN |
|---|:---:|:---:|:---:|:---:|
| Own profile | ✓ | ✓ | ✓ | ✓ |
| Patient own medical record | ✓ | — | — | — |
| Patient own treatment plans | ✓ | — | — | — |
| Assigned patient list/details | — | ✓ | — | — |
| Assigned patient medical record | — | ✓ | — | — |
| Medical notes | — | ✓ | — | — |
| Treatment plan management | — | ✓ | — | — |
| Medication management | — | ✓ | — | — |
| Appointment management | — | ✓ | — | — |
| Doctor–Patient assignment management | — | — | — | ✓ |

Frontend route guards improve UX, but they do not replace backend authorization.

---

## 12. Suggested Frontend Service Structure

A practical React structure:

```text
src/
├── api/
│   ├── apiClient.js
│   ├── authApi.js
│   ├── profileApi.js
│   ├── doctorPatientsApi.js
│   ├── assignmentsApi.js
│   ├── medicalRecordsApi.js
│   ├── medicalNotesApi.js
│   ├── treatmentPlansApi.js
│   ├── medicationsApi.js
│   └── appointmentsApi.js
├── auth/
│   └── ...
└── ...
```

`apiClient` should be the single place responsible for attaching the JWT to protected requests.

Do not scatter token/header logic across individual pages.

---

## 13. Frontend Checklist

Before marking a screen integrated:

- [ ] Use the documented HTTP method and route.
- [ ] Send `Authorization: Bearer <token>` for protected endpoints.
- [ ] Do not send server-controlled ownership fields.
- [ ] Handle `400`, `401`, `403`, `404`, and `409` appropriately.
- [ ] Show field validation errors from `errors`.
- [ ] Apply role-aware navigation/route guards.
- [ ] Do not expose Patient `national_id` outside the Patient's own authorized profile flow.
- [ ] Do not allow `national_id` editing.
- [ ] Do not implement Forgot/Reset Password in the current release.
- [ ] On logout, remove local JWT/auth state.
- [ ] Never assume an inactive Doctor–Patient assignment grants access.

- [ ] Keep frontend models/types aligned with the backend response rather than inventing fields.

---

## 14. Current Scope Notes

- Password recovery/reset: future enhancement.
- Logout: client-side removal of stateless JWT/auth state; no server-side revocation endpoint.
- HTTPS: production deployment must expose client traffic through HTTPS; TLS is expected at the reverse proxy/load balancer.
- Patient National ID: current approved requirement for Patient only.
- The backend remains the authority for authentication, authorization, relationship checks, validation, and business-rule enforcement.

## 15. Source of Truth

When this guide and backend behavior appear to differ, check in this order:

1. `docs/requirements/SRS.md` — required system behavior and approved addenda.
2. `docs/requirements/PATIENT_INTAKE_AND_CARE_COORDINATION.md` — approved intake and care-coordination decisions.
3. `docs/database/ERD.md` — approved entities and relationships.
4. `docs/database/Data-Dictionary.md` — fields and constraints.
5. `docs/api/README.md` — detailed current backend API behavior.
6. `FRONTEND_INTEGRATION.md` — frontend-oriented integration summary.

Do not silently invent a request field, response field, endpoint, permission, or workflow. Raise the mismatch with the backend team first.

## Admin Join Request Review

These endpoints are available only to `ADMIN` users and are used to review Doctor and NGO registration requests.

### List join requests

```http
GET /api/admin/join-requests
```

### View join request

```http
GET /api/admin/join-requests/:id
```

### Approve join request

```http
PATCH /api/admin/join-requests/:id/approve
```

Approving a pending Doctor or NGO join request activates the associated account.

### Reject join request

```http
PATCH /api/admin/join-requests/:id/reject
```

Role: `ADMIN`

Join requests may be reviewed only according to the backend's current pending/review rules. The frontend must not assume that an already reviewed request can be reviewed again.

---

## Approved Product Requirements — Intake and Care Coordination

This section records approved behavior and the current backend contract. See `docs/api/README.md` for detailed validation, status codes, and response shapes. Where older sections conflict, this approved target behavior applies.

### Patient intake workflow

- Registration remains account/identity-only. After login, the patient completes one required self-reported health-intake form; it must not be presented as a diagnosis.
- Required information: current health problem (free text), symptoms and onset (allow unknown onset), chronic conditions, current medications, and known allergies. Ask conditional detail for “yes” answers; provide optional additional information. The patient's free text can mention several concerns.
- Keep profile navigation and emergency alerts available before intake completion. Do not allow a doctor assignment or a new assistance request on the patient's behalf until the intake has been submitted.
- Patient-visible statuses are exactly **تم تسليم الطلب**, **قيد المراجعة**, and **تم تعيين طبيب**. The patient may edit after submission until an administrator explicitly starts review; opening the form alone does not lock it. Starting review locks patient edits. Assignment status follows a saved doctor assignment.
- After lock, the patient sends correction/addition requests directly to the administration through the system. An authorized administrator reviews and responds; there is no separate technical-support intermediary in this workflow.
- Backend authorization: patient reads/edits only their own intake while editable; admin can review it; assigned doctors can read it for care; other doctors and NGOs cannot.

### Assignments, capacity, and clinical information

- A patient may have multiple active assignments to different doctors for different concerns. Require a non-empty internal assignment reason describing the concern followed. Reject a duplicate active assignment for the same doctor-patient pair. Do not expose the internal reason to the patient; show the assigned doctor's name, specialization, assignment status, and next step.
- Admin-managed availability is **متاح/غير متاح**. Capacity is used to display workload warnings only and never blocks routine or emergency assignment. Routine assignment to an unavailable doctor is disallowed; emergency assignment remains possible and the admin makes the final decision after seeing availability and workload. Count active patient assignments and open assigned emergency alerts separately.
- Each doctor's diagnosis is separate clinical documentation tied to that doctor and documentation time. Patient and currently assigned doctors may read diagnoses; detailed note text remains author-only. NGO and unassigned doctors cannot read diagnoses.
- Keep assistance requests and emergency alerts as separate workflows. Doctors create assistance requests on behalf of patients; NGOs receive only the information needed for their assigned request, not the intake or complete medical record.

Implemented route families: Patient intake and correction requests under `/api/patient`; admin intake review, doctor workload, and correction-request resolution under `/api/admin`; assigned-doctor intake and diagnosis reads/writes under `/api/doctor`. Capacity is returned as a warning signal only. Enforce permissions and transition rules server-side; do not rely on hidden UI controls.
