# HCMS Corrected ERD

**Sprint 7 reconciliation — Version 1.2**

> Markdown transcription of the approved `ERD.pdf`. It preserves the entities, fields, constraints, foreign-key relationships, and approved Sprint 7 reconciliation rules in a searchable text format. The PDF remains the visual ERD.

## Identity and access

### users

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| full_name | VARCHAR(150) | NN |
| email | VARCHAR(255) | UQ, NN |
| password_hash | VARCHAR(255) | NN |
| role | ENUM | PATIENT / DOCTOR / NGO / ADMIN; NN |
| account_status | ENUM | ACTIVE / INACTIVE / SUSPENDED; NN |
| phone | VARCHAR(30) | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### patients

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, UQ, NN |
| national_id | VARCHAR(9) | UQ, NN |
| date_of_birth | DATE | NN |
| gender | ENUM | MALE / FEMALE; NN |
| address | VARCHAR(255) | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### doctors

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, UQ, NN |
| specialization | VARCHAR(100) | NN |
| license_number | VARCHAR(100) | UQ, NN |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### ngos

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, UQ, NN |
| organization_name | VARCHAR(150) | NN |
| registration_number | VARCHAR(100) | UQ, NN |
| address | VARCHAR(255) | NULL |
| contact_phone | VARCHAR(30) | NN |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### join_requests

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, NN |
| request_type | ENUM | DOCTOR / NGO; NN |
| status | ENUM | PENDING / APPROVED / REJECTED; NN |
| reviewed_by_admin_id | BIGINT UNSIGNED | FK users.id, NULL |
| reviewed_at | TIMESTAMP | NULL |
| rejection_reason | VARCHAR(500) | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

## Clinical care

### doctor_patient_assignments

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| doctor_id | BIGINT UNSIGNED | FK doctors.id, NN |
| patient_id | BIGINT UNSIGNED | FK patients.id, NN |
| status | ENUM | ACTIVE / INACTIVE; NN |
| assignment_reason | VARCHAR(255) | NULL |
| notes | TEXT | NULL |
| assigned_at | TIMESTAMP | NN |
| ended_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### medical_records

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| patient_id | BIGINT UNSIGNED | FK patients.id, UQ, NN |
| blood_type | VARCHAR(5) | NULL |
| allergies | TEXT | NULL |
| chronic_diseases | TEXT | NULL |
| medical_history | TEXT | NULL |
| previous_surgeries | TEXT | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### medical_notes

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| medical_record_id | BIGINT UNSIGNED | FK medical_records.id, NN |
| doctor_id | BIGINT UNSIGNED | FK doctors.id, NN |
| note | TEXT | NN |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### treatment_plans

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| patient_id | BIGINT UNSIGNED | FK patients.id, NN |
| doctor_id | BIGINT UNSIGNED | FK doctors.id, NN |
| title | VARCHAR(150) | NN |
| general_instructions | TEXT | NULL |
| status | ENUM | ACTIVE / COMPLETED / CANCELLED; NN |
| start_date | DATE | NN |
| end_date | DATE | NULL; end_date >= start_date |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### treatment_medications

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| treatment_plan_id | BIGINT UNSIGNED | FK treatment_plans.id, NN |
| medication_name | VARCHAR(150) | NN |
| dosage | VARCHAR(100) | NN |
| frequency | VARCHAR(100) | NN |
| duration | VARCHAR(100) | NULL |
| instructions | TEXT | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### treatment_appointments

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| treatment_plan_id | BIGINT UNSIGNED | FK treatment_plans.id, NN |
| appointment_date | DATETIME | NN |
| purpose | VARCHAR(255) | NN |
| location | VARCHAR(255) | NULL |
| status | ENUM | SCHEDULED / COMPLETED / CANCELLED; NN |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

## Assistance and emergency

### assistance_requests

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| patient_id | BIGINT UNSIGNED | FK patients.id, NN |
| doctor_id | BIGINT UNSIGNED | FK doctors.id, NN |
| ngo_id | BIGINT UNSIGNED | FK ngos.id, NULL |
| request_type | VARCHAR(100) | NN |
| description | TEXT | NN |
| status | ENUM | PENDING / UNDER_REVIEW / APPROVED / REJECTED / COMPLETED; NN |
| submitted_at | TIMESTAMP | NN |
| reviewed_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### resource_allocations

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| assistance_request_id | BIGINT UNSIGNED | FK assistance_requests.id, NN |
| resource_name | VARCHAR(150) | NN; not an FK |
| quantity | INT UNSIGNED | NN; CHECK > 0 |
| delivery_date | DATE | NULL |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### emergency_alerts

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| patient_id | BIGINT UNSIGNED | FK patients.id, NULL |
| phone | VARCHAR(30) | NN |
| location | VARCHAR(255) | NULL |
| assigned_doctor_id | BIGINT UNSIGNED | FK doctors.id, NULL |
| assigned_by_admin_id | BIGINT UNSIGNED | FK users.id, NULL |
| description | TEXT | NULL |
| priority | ENUM | HIGH / CRITICAL; NN |
| status | ENUM | NEW / PENDING_ASSIGNMENT / ASSIGNED / IN_PROGRESS / RESOLVED / CANCELLED; NN |
| sent_at | TIMESTAMP | NN |
| assigned_at | TIMESTAMP | NULL |
| responded_at | TIMESTAMP | NULL |
| resolved_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

## Communication and administration

### messages

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| sender_id | BIGINT UNSIGNED | FK users.id, NN |
| receiver_id | BIGINT UNSIGNED | FK users.id, NN |
| message_text | TEXT | NN |
| is_read | BOOLEAN | NN; default FALSE |
| sent_at | TIMESTAMP | NN |
| read_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | NN |

### notifications

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, NN |
| title | VARCHAR(150) | NN |
| message | TEXT | NN |
| type | VARCHAR(50) | NN |
| is_read | BOOLEAN | NN; default FALSE |
| reference_type | VARCHAR(50) | Polymorphic, NULL |
| reference_id | BIGINT UNSIGNED | Polymorphic, NULL |
| created_at | TIMESTAMP | NN |
| read_at | TIMESTAMP | NULL |

### reminders

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, NN |
| type | ENUM | MEDICATION / APPOINTMENT; NN |
| reference_type | VARCHAR(50) | Polymorphic, NN |
| reference_id | BIGINT UNSIGNED | Polymorphic, NN |
| remind_at | DATETIME | NN |
| status | ENUM | PENDING / SENT / CANCELLED; NN |
| sent_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

### activity_logs

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| user_id | BIGINT UNSIGNED | FK users.id, NULL |
| action | VARCHAR(50) | NN |
| entity_type | VARCHAR(50) | Polymorphic, NULL |
| entity_id | BIGINT UNSIGNED | Polymorphic, NULL |
| description | TEXT | NN |
| ip_address | VARCHAR(45) | NULL |
| created_at | TIMESTAMP | NN |

### system_settings

| Field | Data type | Constraint / values |
|---|---|---|
| id | BIGINT UNSIGNED | PK, AI, NN |
| setting_key | VARCHAR(100) | UQ, NN |
| setting_value | TEXT | NULL |
| description | VARCHAR(255) | NULL |
| updated_by_admin_id | BIGINT UNSIGNED | FK users.id, NULL |
| created_at | TIMESTAMP | NN |
| updated_at | TIMESTAMP | NN |

## Approved foreign-key relationships

- `patients.user_id` → `users.id`
- `doctors.user_id` → `users.id`
- `ngos.user_id` → `users.id`
- `join_requests.user_id` → `users.id`
- `join_requests.reviewed_by_admin_id` → `users.id`
- `doctor_patient_assignments.doctor_id` → `doctors.id`
- `doctor_patient_assignments.patient_id` → `patients.id`
- `medical_records.patient_id` → `patients.id`
- `medical_notes.medical_record_id` → `medical_records.id`
- `medical_notes.doctor_id` → `doctors.id`
- `treatment_plans.patient_id` → `patients.id`
- `treatment_plans.doctor_id` → `doctors.id`
- `treatment_medications.treatment_plan_id` → `treatment_plans.id`
- `treatment_appointments.treatment_plan_id` → `treatment_plans.id`
- `assistance_requests.patient_id` → `patients.id`
- `assistance_requests.doctor_id` → `doctors.id`
- `assistance_requests.ngo_id` → `ngos.id`
- `resource_allocations.assistance_request_id` → `assistance_requests.id`
- `emergency_alerts.patient_id` → `patients.id`
- `emergency_alerts.assigned_doctor_id` → `doctors.id`
- `emergency_alerts.assigned_by_admin_id` → `users.id`
- `messages.sender_id` → `users.id`
- `messages.receiver_id` → `users.id`
- `notifications.user_id` → `users.id`
- `reminders.user_id` → `users.id`
- `activity_logs.user_id` → `users.id`
- `system_settings.updated_by_admin_id` → `users.id`

## Approved business rules

1. Multiple historical doctor-patient assignments may exist for the same pair, but only one `ACTIVE` assignment is allowed at a time.
2. Only one `PENDING` join request is allowed for the same user at a time.
3. Messaging is allowed only between a Patient and a Doctor who has an `ACTIVE` assignment with that Patient.
4. Emergency assignment is allowed only to an `ACTIVE` Doctor specialized in `General Medicine` or `Emergency Medicine`.
5. Doctor and NGO accounts are activated only after Admin approval; Patient accounts do not require a Join Request.
6. Notification and Reminder `reference_type` / `reference_id` values are validated in the Backend and are not direct foreign keys.
7. Activity Log `entity_type` / `entity_id` values are validated in the Backend and are not direct foreign keys.
8. Sprint 7 Emergency Alerts: `patient_id` is nullable for public Visitor alerts; `phone` is required; `location` and `description` are optional; application-created alerts start at `PENDING_ASSIGNMENT`.

## Corrections applied to the previous ERD

1. Removed undocumented `emergency_alerts` fields: `alert_type`, `latitude`, `longitude`, and `cancelled_at`.
2. Emergency `phone` is `VARCHAR(30)`; `patient_id` and `description` are nullable; `assigned_by_admin_id` and `assigned_at` are retained.
3. Assistance Requests use `doctor_id` and `request_type VARCHAR(100)`.

4. Notifications use `title VARCHAR(150)` and `type VARCHAR(50)`; no `sent_at` column is defined.
5. Reminders require both `reference_type` and `reference_id`; `sent_at` remains nullable.
6. Activity Logs use `action VARCHAR(50)` and `description TEXT NOT NULL`.
7. System Settings `description` is `VARCHAR(255)`.
8. Resource Allocation `resource_name` is `VARCHAR(150)`, is not an FK, and no resources table exists.

**Legend:** PK = Primary Key; FK = Foreign Key; UQ = Unique; NN = Not Null; NULL = Nullable; AI = Auto Increment.

## Approved Data-Model Change Requirements — Not Yet in the Current ERD

The ERD above remains the transcription of the approved baseline ERD PDF. The following requirements have since been approved and require a reviewed ERD/PDF revision before schema implementation:

- Introduce a patient health-intake entity separate from `medical_records` and `medical_notes`. It stores the patient's self-reported answers, workflow status, submission/update timestamps, and the administrator/review-start timestamp and identity. The intake is a single submission per patient in the current scope; the patient may edit it until explicit admin review begins.
- Model explicit transitions corresponding to **تم تسليم الطلب**, **قيد المراجعة**, and **تم تعيين طبيب**. Viewing an intake does not start review; the admin action to start review locks patient edits. Post-lock correction is a technical-support request routed to an administrator and does not grant support access to intake data.
- Add doctor availability and admin-configured capacity attributes. Assignment and emergency workload counts are derived from existing assignments and alerts; capacity is informational, not a database or application assignment limit.
- Require an internal `assignment_reason` for new doctor-patient assignments. Keep the existing rule that multiple doctors may be active for one patient while preventing duplicate active assignments for the same pair.
- Store each doctor's diagnosis with that doctor's clinical documentation, author identity, and timestamp. Do not store a single global diagnosis on the patient's `medical_records` row.

These are logical requirements, not finalized table/column names or migration instructions. Review authorization paths so the patient, administrators, and assigned doctors receive only the access defined in the approved SRS addendum; NGOs and unassigned doctors receive no intake/diagnosis access.
