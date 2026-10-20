/**
 * @openapi
 * /api/doctor/patients:
 *   get:
 *     tags: [Assigned Patients]
 *     summary: List assigned Patients
 *     description: Lists Patients with an ACTIVE Doctor-Patient Assignment to the authenticated Doctor, ordered by Patient name and ID. The response does not include national_id.
 *     operationId: listAssignedPatients
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Assigned Patients retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Assigned Patients retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AssignedPatient' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or user is not a Doctor
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/doctor/patients/{patientId}:
 *   get:
 *     tags: [Assigned Patients]
 *     summary: Get assigned Patient
 *     description: Returns safe profile fields only if the Patient has an ACTIVE assignment to the authenticated Doctor. The response does not include national_id.
 *     operationId: getAssignedPatient
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Assigned Patient retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Assigned Patient retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patient: { $ref: '#/components/schemas/AssignedPatient' }
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
 */
