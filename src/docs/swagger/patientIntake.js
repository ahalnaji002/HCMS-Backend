/**
 * @openapi
 * /api/patient/intake:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Get the authenticated Patient's intake
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Intake retrieved; data.intake is null before submission }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403': { description: Authenticated user is not a Patient }
 *   post:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Submit the Patient's one self-reported intake
 *     description: This self-report is not a diagnosis. Status and patient identity are server-managed.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PatientIntakeInput' }
 *     responses:
 *       '201': { description: Intake submitted with status SUBMITTED }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '409': { description: Patient already submitted an intake }
 *   put:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Edit the Patient's intake before review starts
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PatientIntakeInput' }
 *     responses:
 *       '200': { description: Intake updated while status is SUBMITTED }
 *       '404': { description: Intake not found }
 *       '409': { description: Review has started and intake is locked }
 * /api/admin/patient-intakes:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List Patient intakes for administrative review
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Intakes with patient name and email }
 * /api/admin/patient-intakes/{intakeId}/start-review:
 *   patch:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Explicitly start review and lock Patient edits
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: intakeId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 'Status UNDER_REVIEW, reviewer ID, and review time are stored' }
 *       '404': { description: Intake not found }
 *       '409': { description: Intake is not SUBMITTED }
 * /api/doctor/patients/{patientId}/intake:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Read intake for an actively assigned Patient
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: Assigned Patient intake }
 *       '403': { description: Doctor has no ACTIVE assignment to Patient }
 *       '404': { description: Patient or intake not found }
 * /api/doctor/patients/{patientId}/diagnoses:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List diagnoses for an actively assigned Patient
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 'Diagnoses with author, specialization, and time' }
 *       '403': { description: Doctor has no ACTIVE assignment to Patient }
 *   post:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Record a diagnosis for an actively assigned Patient
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [diagnosis]
 *             properties:
 *               diagnosis: { type: string, minLength: 1 }
 *     responses:
 *       '201': { description: Diagnosis stored with authenticated Doctor identity }
 *       '403': { description: Doctor has no ACTIVE assignment to Patient }
 * /api/patient/diagnoses:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List diagnoses for the authenticated Patient
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Patient's diagnoses with author and documentation time }
 * /api/patient/intake-correction-requests:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List own correction requests
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Requests belonging to authenticated Patient }
 *   post:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Send an intake correction request to administration
 *     description: Available after review starts; requests are submitted directly to administration, with no separate technical-support intermediary.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [message]
 *             properties:
 *               message: { type: string, minLength: 1, maxLength: 5000 }
 *     responses:
 *       '201': { description: Correction request created as OPEN }
 *       '409': { description: Review has not started }
 * /api/admin/intake-correction-requests:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List correction requests for administration
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Requests with Patient name and email }
 * /api/admin/intake-correction-requests/{requestId}/resolve:
 *   patch:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Resolve a correction request as an Admin
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [admin_response]
 *             properties:
 *               admin_response: { type: string, minLength: 1, description: Whitespace-only values are rejected; maximum 65535 UTF-8 bytes }
 *     responses:
 *       '200': { description: Resolved with Admin ID and timestamp }
 *       '409': { description: Request is already resolved }
 * /api/admin/active-doctors:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List active Doctors with separate workload counts
 *     description: Capacity warning is informational and never blocks assignment.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: 'Doctors with active_assignment_count, open_emergency_alert_count, and capacity_warning' }
 * /api/admin/doctors/{doctorId}/workload:
 *   patch:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: Update Doctor availability and capacity
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               availability: { type: string, enum: [AVAILABLE, UNAVAILABLE] }
 *               capacity_limit: { type: integer, minimum: 0, nullable: true }
 *     responses:
 *       '200': { description: Doctor workload settings updated }
 * components:
 *   schemas:
 *     PatientIntakeInput:
 *       type: object
 *       additionalProperties: false
 *       required: [current_problem, symptoms, symptom_onset, chronic_conditions_answer, medications_answer, allergies_answer]
 *       properties:
 *         current_problem: { type: string, minLength: 1 }
 *         symptoms: { type: string, minLength: 1 }
 *         symptom_onset: { type: string, minLength: 1, maxLength: 255, description: Unknown onset is allowed; maximum 255 characters }
 *         chronic_conditions_answer: { type: string, enum: [YES, NO, UNKNOWN] }
 *         chronic_conditions_details: { type: string, description: Required for YES }
 *         medications_answer: { type: string, enum: [YES, NO, UNKNOWN] }
 *         medications_details: { type: string, description: Required for YES }
 *         allergies_answer: { type: string, enum: [YES, NO, UNKNOWN] }
 *         allergies_details: { type: string, description: Required for YES }
 *         additional_information: { type: string, nullable: true }
 */
