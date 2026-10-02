/**
 * @openapi
 * /api/doctor/patients/{patientId}/assistance-requests:
 *   post:
 *     tags: [Assistance Requests]
 *     summary: Create Assistance Request for assigned Patient
 *     description: Submits an Assistance Request for a Patient with an ACTIVE assignment to the authenticated Doctor.
 *     operationId: createAssistanceRequestForPatient
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
 *             required: [request_type, description]
 *             properties:
 *               request_type: { type: string, minLength: 1, maxLength: 100 }
 *               description: { type: string, minLength: 1, description: Must not be whitespace-only; maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Assistance Request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Assistance Request created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     assistance_request: { $ref: '#/components/schemas/AssistanceRequest' }
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
 * /api/doctor/assistance-requests/{requestId}/resources:
 *   get:
 *     tags: [Resource Allocations]
 *     summary: List resources for Assistance Request
 *     description: Returns resource allocations when the authenticated Doctor submitted the Assistance Request.
 *     operationId: listDoctorAssistanceRequestResources
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Resource Allocations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Resource Allocations retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     resource_allocations:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ResourceAllocation' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or the request was submitted by another Doctor
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Assistance Request or Doctor profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/doctor/emergency-alerts/{alertId}/status:
 *   patch:
 *     tags: [Emergency Alerts]
 *     summary: Update assigned Emergency Alert status
 *     description: The assigned Doctor can transition an alert from ASSIGNED to IN_PROGRESS, then from IN_PROGRESS to RESOLVED.
 *     operationId: updateAssignedEmergencyAlertStatus
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [IN_PROGRESS, RESOLVED] }
 *     responses:
 *       '200':
 *         description: Emergency Alert status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Emergency Alert status updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergency_alert: { $ref: '#/components/schemas/EmergencyAlert' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or user is not a Doctor
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Emergency Alert not assigned to this Doctor or Doctor profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: Requested status is not a valid transition from the alert's current status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
