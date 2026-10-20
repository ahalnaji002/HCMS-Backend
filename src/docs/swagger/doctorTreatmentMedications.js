/**
 * @openapi
 * /api/doctor/treatment-plans/{planId}/medications:
 *   post:
 *     tags: [Doctor Treatment Medications]
 *     summary: Add Treatment Medication
 *     description: Adds a medication to an authorized Treatment Plan. Doctor access requires an ACTIVE assignment to the Patient.
 *     operationId: createTreatmentMedication
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *             additionalProperties: false
 *             required: [medication_name, dosage, frequency]
 *             properties:
 *               medication_name: { type: string, minLength: 1, maxLength: 150 }
 *               dosage: { type: string, minLength: 1, maxLength: 100 }
 *               frequency: { type: string, minLength: 1, maxLength: 100 }
 *               duration: { type: string, nullable: true, maxLength: 100 }
 *               instructions: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Treatment Medication created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Medication created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medication: { $ref: '#/components/schemas/TreatmentMedication' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, or Patient not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   get:
 *     tags: [Doctor Treatment Medications]
 *     summary: List Treatment Medications
 *     operationId: listTreatmentMedications
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Medications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Medications retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medications:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/TreatmentMedication' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, or Patient not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/doctor/treatment-plans/{planId}/medications/{medicationId}:
 *   get:
 *     tags: [Doctor Treatment Medications]
 *     summary: Get Treatment Medication
 *     operationId: getTreatmentMedication
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: medicationId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Medication retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Medication retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medication: { $ref: '#/components/schemas/TreatmentMedication' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, Patient, or medication not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   patch:
 *     tags: [Doctor Treatment Medications]
 *     summary: Update Treatment Medication
 *     description: Updates one or more supplied fields on a medication belonging to the authorized plan. An empty update is rejected.
 *     operationId: updateTreatmentMedication
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: medicationId
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
 *               medication_name: { type: string, minLength: 1, maxLength: 150 }
 *               dosage: { type: string, minLength: 1, maxLength: 100 }
 *               frequency: { type: string, minLength: 1, maxLength: 100 }
 *               duration: { type: string, nullable: true, maxLength: 100 }
 *               instructions: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '200':
 *         description: Treatment Medication updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Medication updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medication: { $ref: '#/components/schemas/TreatmentMedication' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, Patient, or medication not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   delete:
 *     tags: [Doctor Treatment Medications]
 *     summary: Delete Treatment Medication
 *     description: Deletes a medication belonging to the authorized Treatment Plan and returns the deleted record.
 *     operationId: deleteTreatmentMedication
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: medicationId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Medication deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Medication deleted successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     medication: { $ref: '#/components/schemas/TreatmentMedication' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, Patient, or medication not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
