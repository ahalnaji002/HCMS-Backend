# Patient Intake and Care Coordination

**Decision status:** Approved product requirements; backend implementation merged into `develop` through PR #95 and frontend implementation merged into `develop` through PR #46.
**Scope:** Approved product behavior for patient intake, assignment coordination, and clinical diagnosis records.
**Authority note:** This addendum supplements the maintained Markdown SRS, ERD, Data Dictionary, and API documentation. These Markdown files are the current project references; no PDF copy is treated as authoritative. The requirements describe approved behavior, while implementation status is recorded above.

## Platform scope

HCMS is a multi-organization coordination network. Current participants are patients, individual doctors, NGOs, and administrators. Hospitals do not have a separate account or organization role in this scope.

## Patient entry and health-intake form

1. Registration collects account and identity information; it does not ask the patient to describe their health condition.
2. After login, the patient completes one required health-intake form. The form is a self-reported description, not a diagnosis or an NGO assistance request.
3. Required questions cover the current health problem (free text), symptoms and when they started (free text; unknown onset is allowed), chronic conditions, current medications, and known allergies. Ask for details when the patient answers yes. Additional information is optional. The patient may describe multiple health concerns in the free-text answers.
4. The patient may navigate their profile before completing the form. Until submission, no doctor is assigned and no new assistance request is created on their behalf. Emergency alerts remain available.
5. After submission, show **تم تسليم الطلب** and prompt the patient to review answers, explaining that editing remains possible until administration starts its review.
6. An explicit administrator **start review** action changes the status to **قيد المراجعة** and locks patient editing. Merely opening or viewing the form does not lock it.
7. After an administrator saves a doctor assignment, the patient-facing status is **تم تعيين طبيب**. Show the doctor's name, specialization, assignment status, and next step.
8. After lock, the patient may submit a correction/addition request directly to the administration through the system. An authorized administrator reviews and responds to the request. This workflow has no separate technical-support intermediary; only authorized administrators may access and resolve the request, subject to the intake access rules.

## Assignment, availability, and workload

- Administrators review the intake and choose doctors. A patient may have multiple active doctor assignments for different concerns. Each assignment has a required internal reason describing what that doctor follows; it is not shown to the patient. A doctor-patient pair cannot have duplicate active assignments.
- Administration records doctor availability as **متاح/غير متاح** and configures capacity in coordination with the doctor.
- The system displays active patient assignments and open assigned emergency alerts as separate workload indicators.
- Capacity is an alert for administration only. It never blocks an ordinary or emergency assignment. Unavailability blocks ordinary assignment, but does not block emergency assignment; administration sees the indicators and makes the decision.
- Emergency alerts and routine assignments remain separate workflows; existing emergency specialization eligibility rules continue to apply.
- Behavior when a doctor becomes unavailable after patients have already been assigned is outside the current scope.

## Clinical documentation and visibility

- Patient intake remains a self-report. Each doctor records their own diagnosis in that doctor's clinical documentation, associated with the author and documentation time. There is no shared patient-level diagnosis field.
- The patient and doctors currently assigned to that patient may read diagnoses. Detailed medical-note text is visible only to its authoring doctor.
- The patient can read their own intake; administrators can read it for review and assignment; assigned doctors can read it for care. Unassigned doctors and NGOs cannot access the intake or diagnoses. Backend APIs must enforce these permissions.
- The doctor creates assistance requests on the patient's behalf. NGOs receive only the information needed to process an assistance request assigned to them, not the intake form or complete medical record.

## Current implementation versus approved target

The maintained Markdown SRS, ERD, and Data Dictionary are the current references for the approved baseline and this extension. The backend implementation and migrations `202610080001`–`202610080004` are merged into backend `develop` through PR #95; the frontend implementation is merged into frontend `develop` through PR #46. Current API contracts are documented in [`docs/api/README.md`](../api/README.md). Verify migration execution and cross-role integration behavior against a dedicated test database before release verification.
