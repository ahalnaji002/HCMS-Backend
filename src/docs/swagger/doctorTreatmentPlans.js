/**
 * @openapi
 * /api/doctor/patients/{patientId}/treatment-plans:
 *   post:
 *     tags: [Doctor Treatment Plans]
 *     summary: Create Treatment Plan
 *     description: Creates a plan for a Patient with an ACTIVE assignment to the authenticated Doctor. If end_date is supplied it must be on or after start_date.
 *     operationId: createAssignedPatientTreatmentPlan
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
 *             required: [title, start_date]
 *             properties:
 *               title: { type: string, minLength: 1, maxLength: 150 }
 *               general_instructions: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               start_date: { type: string, format: date, example: '2026-10-01' }
 *               end_date: { type: string, format: date, nullable: true, example: '2026-10-31' }
 *     responses:
 *       '201':
 *         description: Treatment Plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Plan created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatment_plan: { $ref: '#/components/schemas/TreatmentPlan' }
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
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   get:
 *     tags: [Doctor Treatment Plans]
 *     summary: List Treatment Plans for assigned Patient
 *     operationId: listAssignedPatientTreatmentPlans
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Plans retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatment_plans:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/TreatmentPlan' }
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
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/doctor/patients/{patientId}/treatment-plans/{planId}:
 *   get:
 *     tags: [Doctor Treatment Plans]
 *     summary: Get Treatment Plan
 *     description: Returns a Treatment Plan for the Patient only when the authenticated Doctor has an ACTIVE assignment.
 *     operationId: getAssignedPatientTreatmentPlan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Plan retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatment_plan: { $ref: '#/components/schemas/TreatmentPlan' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient, Doctor profile, or Treatment Plan not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   patch:
 *     tags: [Doctor Treatment Plans]
 *     summary: Update Treatment Plan
 *     description: Requires an ACTIVE assignment and at least one editable field. If the resulting end_date is set, it must be on or after the resulting start_date.
 *     operationId: updateAssignedPatientTreatmentPlan
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: planId
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
 *               title: { type: string, minLength: 1, maxLength: 150 }
 *               general_instructions: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *               status: { type: string, enum: [ACTIVE, COMPLETED, CANCELLED] }
 *               start_date: { type: string, format: date }
 *               end_date: { type: string, format: date, nullable: true }
 *     responses:
 *       '200':
 *         description: Treatment Plan updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Plan updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatment_plan: { $ref: '#/components/schemas/TreatmentPlan' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Patient, Doctor profile, or Treatment Plan not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
