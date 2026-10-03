/**
 * @openapi
 * /api/doctor/patients/{patientId}/medical-record:
 *   post:
 *     tags: [Doctor Medical Records]
 *     summary: Create Medical Record
 *     description: Creates the Patient's Medical Record. Requires an ACTIVE assignment. Only the listed clinical fields are accepted; all are optional and may be null.
 *     operationId: createAssignedPatientMedicalRecord
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
 *             properties:
 *               blood_type: { type: string, nullable: true, maxLength: 5 }
 *               allergies: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               chronic_diseases: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               medical_history: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               previous_surgeries: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Medical Record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Medical Record created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medical_record: { $ref: '#/components/schemas/MedicalRecord' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient or Doctor profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: A Medical Record already exists for this Patient
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   get:
 *     tags: [Doctor Medical Records]
 *     summary: Get assigned Patient Medical Record
 *     description: Requires an ACTIVE Doctor-Patient Assignment.
 *     operationId: getAssignedPatientMedicalRecord
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Medical Record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Medical Record retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medical_record: { $ref: '#/components/schemas/MedicalRecord' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient, Doctor profile, or Medical Record not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   patch:
 *     tags: [Doctor Medical Records]
 *     summary: Update assigned Patient Medical Record
 *     description: Requires an ACTIVE assignment and at least one editable field. Supplied fields may be null; unknown fields are rejected.
 *     operationId: updateAssignedPatientMedicalRecord
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
 *             minProperties: 1
 *             additionalProperties: false
 *             properties:
 *               blood_type: { type: string, nullable: true, maxLength: 5 }
 *               allergies: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               chronic_diseases: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               medical_history: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               previous_surgeries: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '200':
 *         description: Medical Record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Medical Record updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medical_record: { $ref: '#/components/schemas/MedicalRecord' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient, Doctor profile, or Medical Record not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/doctor/patients/{patientId}/medical-notes:
 *   post:
 *     tags: [Doctor Medical Records]
 *     summary: Add Medical Note
 *     description: Adds a note to the Patient's Medical Record. Requires an ACTIVE assignment and an existing Medical Record. Notes are listed only to their author Doctor.
 *     operationId: createAssignedPatientMedicalNote
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
 *             required: [note]
 *             properties:
 *               note: { type: string, minLength: 1, description: Must not be whitespace-only; maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Medical Note created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Medical Note created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medical_note: { $ref: '#/components/schemas/MedicalNote' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient, Doctor profile, or Medical Record not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   get:
 *     tags: [Doctor Medical Records]
 *     summary: List Medical Notes written by the Doctor
 *     description: Returns notes authored by the authenticated Doctor for the Patient's record. Requires an ACTIVE assignment and an existing Medical Record.
 *     operationId: listAssignedPatientMedicalNotes
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Medical Notes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Medical Notes retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medical_notes:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/MedicalNote' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient, Doctor profile, or Medical Record not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
