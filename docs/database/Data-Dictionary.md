# 2.2.3 Data Dictionary

**Healthcare Conflict Management System (HCMS)**  
Maintained database schema reference | Updated October 2026 | Markdown

This maintained Markdown data dictionary defines the fields, data types, keys, constraints, nullability, defaults, and descriptions for the HCMS database schema, including approved extensions.

> Use this file as the current reference for the approved database fields and constraints.

## 1. users

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique user identifier |
| full_name | VARCHAR(150) | — | No | — | User full name |
| email | VARCHAR(255) | UNIQUE | No | — | Login email |
| password_hash | VARCHAR(255) | — | No | — | Password after hashing |
| role | ENUM | PATIENT, DOCTOR, NGO, ADMIN | No | — | User role |
| account_status | ENUM | ACTIVE, INACTIVE, SUSPENDED | No | ACTIVE | Current account status |
| phone | VARCHAR(30) | — | Yes | NULL | Phone number |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 2. patients

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique patient identifier |
| user_id | BIGINT UNSIGNED | FK → users.id, UNIQUE | No | — | Linked user account |
| national_id | VARCHAR(9) | UNIQUE, CHECK (`^[1-9][0-9]{8}$`) | No | — | 9-digit national ID that must not start with zero |
| date_of_birth | DATE | — | No | — | Date of birth |
| gender | ENUM | MALE, FEMALE | No | — | Gender |
| address | VARCHAR(255) | — | Yes | NULL | Address |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Patient profile creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 3. doctors

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique Doctor identifier |
| user_id | BIGINT UNSIGNED | FK → users.id, UNIQUE | No | — | Linked user account |
| specialization | VARCHAR(100) | — | No | — | Doctor specialization |
| license_number | VARCHAR(100) | UNIQUE | No | — | License number |
| availability | ENUM | AVAILABLE, UNAVAILABLE | No | AVAILABLE | Admin-managed routine-assignment availability |
| capacity_limit | INT UNSIGNED | — | Yes | NULL | Informational assignment capacity; does not block assignment |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Doctor profile creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 4. ngos

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique NGO identifier |
| user_id | BIGINT UNSIGNED | FK → users.id, UNIQUE | No | — | NGO account |
| organization_name | VARCHAR(150) | — | No | — | Organization name |
| registration_number | VARCHAR(100) | UNIQUE | Yes | NULL | Organization registration number |
| address | VARCHAR(255) | — | Yes | NULL | Organization address |
| contact_phone | VARCHAR(30) | — | Yes | NULL | Official contact number |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | NGO record creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 5. join_requests

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique request identifier |
| user_id | BIGINT UNSIGNED | FK → users.id | No | — | Request owner |
| request_type | ENUM | DOCTOR, NGO | No | — | Request type |
| status | ENUM | PENDING, APPROVED, REJECTED | No | PENDING | Request status |
| reviewed_by_admin_id | BIGINT UNSIGNED | FK → users.id | Yes | NULL | Admin who reviewed the request |
| reviewed_at | TIMESTAMP | — | Yes | NULL | Review time |
| rejection_reason | VARCHAR(500) | — | Yes | NULL | Rejection reason |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Request creation time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 6. doctor_patient_assignments

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique assignment identifier |
| doctor_id | BIGINT UNSIGNED | FK → doctors.id, INDEX | No | — | Assigned Doctor |
| patient_id | BIGINT UNSIGNED | FK → patients.id, INDEX | No | — | Patient |
| status | ENUM | ACTIVE, INACTIVE | No | ACTIVE | Assignment status |
| assignment_reason | VARCHAR(255) | — | Yes | NULL | Assignment reason or related medical condition |
| notes | TEXT | — | Yes | NULL | Additional assignment notes |
| assigned_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Assignment start |
| ended_at | TIMESTAMP | — | Yes | NULL | Assignment end |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 7. medical_records

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique medical record identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id, UNIQUE | No | — | Patient owning the record |
| blood_type | VARCHAR(5) | — | Yes | NULL | Blood type |
| allergies | TEXT | — | Yes | NULL | Allergies |
| chronic_diseases | TEXT | — | Yes | NULL | Chronic diseases |
| medical_history | TEXT | — | Yes | NULL | Medical history |
| previous_surgeries | TEXT | — | Yes | NULL | Previous surgeries |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 8. medical_notes

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique note identifier |
| medical_record_id | BIGINT UNSIGNED | FK → medical_records.id | No | — | Medical record |
| doctor_id | BIGINT UNSIGNED | FK → doctors.id | No | — | Authoring Doctor |
| note | TEXT | — | No | — | Medical note text |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 9. treatment_plans

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique plan identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id | No | — | Patient |
| doctor_id | BIGINT UNSIGNED | FK → doctors.id | No | — | Creating Doctor |
| title | VARCHAR(150) | — | No | — | Plan title |
| general_instructions | TEXT | — | Yes | NULL | General instructions |
| status | ENUM | ACTIVE, COMPLETED, CANCELLED | No | ACTIVE | Plan status |
| start_date | DATE | CHECK | No | — | Calendar date; API format YYYY-MM-DD |
| end_date | DATE | CHECK: end_date ≥ start_date | Yes | NULL | Calendar date; API format YYYY-MM-DD |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Plan creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 10. treatment_medications

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique medication identifier |
| treatment_plan_id | BIGINT UNSIGNED | FK → treatment_plans.id | No | — | Treatment plan |
| medication_name | VARCHAR(150) | — | No | — | Medication name |
| dosage | VARCHAR(100) | — | No | — | Dosage |
| frequency | VARCHAR(100) | — | No | — | Dose frequency |
| duration | VARCHAR(100) | — | Yes | NULL | Usage duration |
| instructions | TEXT | — | Yes | NULL | Usage instructions |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Addition time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 11. treatment_appointments

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique appointment identifier |
| treatment_plan_id | BIGINT UNSIGNED | FK → treatment_plans.id | No | — | Treatment plan |
| appointment_date | DATETIME | — | No | — | Palestinian local wall-clock time in Asia/Hebron; API format YYYY-MM-DD HH:mm:ss; no UTC conversion or offset |
| purpose | VARCHAR(255) | — | No | — | Appointment purpose |
| location | VARCHAR(255) | — | Yes | NULL | Appointment location |
| status | ENUM | SCHEDULED, COMPLETED, CANCELLED | No | SCHEDULED | Appointment status |
| notes | TEXT | — | Yes | NULL | Additional notes |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Appointment creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 12. assistance_requests

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique request identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id | No | — | Beneficiary Patient |
| doctor_id | BIGINT UNSIGNED | FK → doctors.id | No | — | Doctor who submitted the request |
| ngo_id | BIGINT UNSIGNED | FK → ngos.id | Yes | NULL | Assigned NGO; NULL before assignment |
| request_type | VARCHAR(100) | — | No | — | Assistance type |
| description | TEXT | — | No | — | Request description |
| status | ENUM | PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED | No | PENDING | Request status |
| submitted_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Submission time |
| reviewed_at | TIMESTAMP | — | Yes | NULL | Review time |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 13. resource_allocations

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique resource identifier |
| assistance_request_id | BIGINT UNSIGNED | FK → assistance_requests.id | No | — | Assistance Request |
| resource_name | VARCHAR(150) | — | No | — | Resource name |
| quantity | INT UNSIGNED | CHECK > 0 | No | 1 | Quantity |
| delivery_date | DATE | — | Yes | NULL | Delivery date |
| notes | TEXT | — | Yes | NULL | Notes |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Allocation creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 14. emergency_alerts

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique alert identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id | Yes | NULL | Sending Patient; NULL for a public Visitor alert |
| phone | VARCHAR(30) | — | No | — | Emergency contact phone entered on creation |
| location | VARCHAR(255) | — | Yes | NULL | Location entered by sender |
| assigned_doctor_id | BIGINT UNSIGNED | FK → doctors.id | Yes | NULL | Assigned Doctor; NULL before assignment |
| assigned_by_admin_id | BIGINT UNSIGNED | FK → users.id | Yes | NULL | Admin who assigned the Doctor |
| description | TEXT | — | Yes | NULL | Optional emergency description |
| priority | ENUM | HIGH, CRITICAL | No | HIGH | Priority |
| status | ENUM | NEW, PENDING_ASSIGNMENT, ASSIGNED, IN_PROGRESS, RESOLVED, CANCELLED | No | NEW | Alert status; Sprint 7 Backend creates application alerts as PENDING_ASSIGNMENT |
| sent_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Send time |
| assigned_at | TIMESTAMP | — | Yes | NULL | Assignment time |
| responded_at | TIMESTAMP | — | Yes | NULL | First response time |
| resolved_at | TIMESTAMP | — | Yes | NULL | Resolution time |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 15. messages

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique message identifier |
| sender_id | BIGINT UNSIGNED | FK → users.id | No | — | Sender |
| receiver_id | BIGINT UNSIGNED | FK → users.id | No | — | Receiver |
| message_text | TEXT | — | No | — | Message text |
| is_read | BOOLEAN | — | No | FALSE | Read status |
| sent_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Send time |
| read_at | TIMESTAMP | — | Yes | NULL | Read time |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation |

## 16. notifications

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique notification identifier |
| user_id | BIGINT UNSIGNED | FK → users.id | No | — | Recipient |
| title | VARCHAR(150) | — | No | — | Notification title |
| message | TEXT | — | No | — | Notification content |
| type | VARCHAR(50) | — | No | — | Notification type |
| is_read | BOOLEAN | — | No | FALSE | Read status |
| reference_type | VARCHAR(50) | Polymorphic Reference | Yes | NULL | Related record type |
| reference_id | BIGINT UNSIGNED | Polymorphic Reference | Yes | NULL | Related record identifier |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Notification creation |
| read_at | TIMESTAMP | — | Yes | NULL | Read time |

## 17. activity_logs

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique activity log identifier |
| user_id | BIGINT UNSIGNED | FK → users.id | Yes | NULL | User; NULL for automatic events |
| action | VARCHAR(50) | — | No | — | Executed action |
| entity_type | VARCHAR(50) | Polymorphic Reference | Yes | NULL | Affected entity type |
| entity_id | BIGINT UNSIGNED | Polymorphic Reference | Yes | NULL | Affected entity identifier |
| description | TEXT | — | No | — | Operation description |
| ip_address | VARCHAR(45) | — | Yes | NULL | IP address |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Event time |

## 18. reminders

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique reminder identifier |
| user_id | BIGINT UNSIGNED | FK → users.id | No | — | Recipient user |
| type | ENUM | MEDICATION, APPOINTMENT | No | — | Reminder type |
| reference_type | VARCHAR(50) | Polymorphic Reference | No | — | Related item type |
| reference_id | BIGINT UNSIGNED | Polymorphic Reference | No | — | Related item identifier |
| remind_at | DATETIME | — | No | — | Reminder time |
| status | ENUM | PENDING, SENT, CANCELLED | No | PENDING | Reminder status |
| sent_at | TIMESTAMP | — | Yes | NULL | Actual send time |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Reminder creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## 19. system_settings

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique setting identifier |
| setting_key | VARCHAR(100) | UNIQUE | No | — | Setting name |
| setting_value | TEXT | — | Yes | NULL | Setting value |
| description | VARCHAR(255) | — | Yes | NULL | Setting description |
| updated_by_admin_id | BIGINT UNSIGNED | FK → users.id | Yes | NULL | Last Admin to update the setting |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Setting creation |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update |

## Business Rules

- More than one historical `doctor_patient_assignment` may exist for the same `doctor_id + patient_id`, but only one `ACTIVE` assignment is allowed at the same time.
- Only one `PENDING` join request is allowed for the same user at the same time.
- Messaging is allowed only between a Patient and a Doctor who has an `ACTIVE` assignment with that Patient.
- Emergency assignment is allowed only to a Doctor whose specialization is `General Medicine` or `Emergency Medicine`.
- Doctor and NGO accounts are activated only after Admin approval.
- Patient accounts do not require a Join Request.
- `reference_type` / `reference_id` in notifications and reminders are validated in the Backend because they are not direct foreign keys.
- `entity_type` / `entity_id` in activity logs are also validated in the Backend.
- Emergency Alerts may be created by an authenticated Patient or by a public Visitor from the Landing Page. Visitor alerts store `patient_id` as `NULL`.
- Every new Emergency Alert requires a contact phone. `location` and `description` are optional.
- Sprint 7 application workflow creates new Emergency Alerts as `PENDING_ASSIGNMENT`; the existing `NEW` enum value remains in the database schema.
- A public Visitor can only submit an Emergency Alert and has no tracking, viewing, editing, cancellation, or authenticated follow-up access.
- Only the originating authenticated Patient may cancel their own Emergency Alert while it is `PENDING_ASSIGNMENT`.
- Emergency Alert assignment is Admin-only. The assigned Doctor must have an `ACTIVE` account and specialization `General Medicine` or `Emergency Medicine`.

## Implemented Approved Schema Extension

The dictionary includes the approved patient-intake and care-coordination schema extension implemented by migrations `202610080001`–`202610080004`.

- Add a patient health-intake submission, separate from `medical_records` and `medical_notes`, containing the patient's self-reported current problem, symptoms/onset, chronic-condition answer/details, medication answer/details, allergy answer/details, optional additional information, submitted/updated timestamps, and workflow state.
- Support the patient-facing workflow **تم تسليم الطلب** → **قيد المراجعة** → **تم تعيين طبيب**. Store the explicit administrator review-start event/time and reviewer identity. The review-start action locks patient edits; simply viewing the submission does not. After lock, patients submit correction requests directly to administration, and authorized administrators review and resolve them without a separate technical-support intermediary.
- Store doctor availability (`متاح/غير متاح`) and admin-configured capacity. Derive active assignment count from `doctor_patient_assignments`; derive assigned open emergency alert count separately. Capacity is informational and must not be a constraint that prevents assignment.
- Make `doctor_patient_assignments.assignment_reason` required for new assignments and treat it as internal administrative/clinical coordination data.
- Add a diagnosis field to each doctor's clinical documentation, tied to the author doctor and documentation timestamp. Do not add a single shared diagnosis field to `medical_records`.
- A patient can have active assignments to multiple doctors, but at most one active assignment for each doctor-patient pair.
- `patient_intakes.review_started_by_admin_id` references the Admin user who explicitly started review.
- `intake_correction_requests` records the patient's message, OPEN/RESOLVED state, administrator response, resolver, and resolution time.
- `doctor_diagnoses` records patient, authoring doctor, diagnosis text, and documentation time.
- `doctors.availability` is `AVAILABLE`/`UNAVAILABLE`; nullable `capacity_limit` is informational. Workload counts are query-derived, not stored.

The following sections define the added table columns and database constraints. The `assignment_reason` requirement applies to new assignments at the application layer; the existing database column remains nullable for compatibility with historical rows.

## 20. patient_intakes

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique intake identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id, UNIQUE | No | — | Patient; one intake per patient |
| current_problem | TEXT | — | No | — | Patient-reported current problem |
| symptoms | TEXT | — | No | — | Patient-reported symptoms |
| symptom_onset | VARCHAR(255) | — | No | — | Reported symptom onset; may express unknown timing |
| chronic_conditions_answer | ENUM | YES, NO, UNKNOWN | No | — | Patient answer about chronic conditions |
| chronic_conditions_details | TEXT | — | Yes | NULL | Details when supplied |
| medications_answer | ENUM | YES, NO, UNKNOWN | No | — | Patient answer about current medications |
| medications_details | TEXT | — | Yes | NULL | Medication details when supplied |
| allergies_answer | ENUM | YES, NO, UNKNOWN | No | — | Patient answer about known allergies |
| allergies_details | TEXT | — | Yes | NULL | Allergy details when supplied |
| additional_information | TEXT | — | Yes | NULL | Optional patient-provided information |
| status | ENUM | SUBMITTED, UNDER_REVIEW, DOCTOR_ASSIGNED | No | SUBMITTED | Intake workflow status |
| submitted_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Submission time |
| review_started_at | TIMESTAMP | — | Yes | NULL | Time an Admin explicitly started review |
| review_started_by_admin_id | BIGINT UNSIGNED | FK → users.id | Yes | NULL | Admin who started review |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update time |

Index: `(status, submitted_at)`.

## 21. intake_correction_requests

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique correction request identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id, INDEX | No | — | Patient who submitted the request |
| message | TEXT | — | No | — | Patient's correction or additional information |
| status | ENUM | OPEN, RESOLVED | No | OPEN | Request workflow status |
| admin_response | TEXT | — | Yes | NULL | Administrator response |
| resolved_by_admin_id | BIGINT UNSIGNED | FK → users.id | Yes | NULL | Admin who resolved the request |
| resolved_at | TIMESTAMP | — | Yes | NULL | Resolution time |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Request creation time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update time |

Index: `(status, created_at)`.

## 22. doctor_diagnoses

| Field | Data Type | Key / Constraint | Null | Default | Description |
|---|---|---|---|---|---|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | No | — | Unique diagnosis identifier |
| patient_id | BIGINT UNSIGNED | FK → patients.id | No | — | Patient the diagnosis belongs to |
| doctor_id | BIGINT UNSIGNED | FK → doctors.id | No | — | Doctor who documented the diagnosis |
| diagnosis | TEXT | — | No | — | Doctor-authored diagnosis |
| documented_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Clinical documentation time |
| created_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | — | No | CURRENT_TIMESTAMP | Last update time |

Indexes: `(patient_id, documented_at)` and `(doctor_id, patient_id)`.
