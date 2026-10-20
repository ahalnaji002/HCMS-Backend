/**
 * @openapi
 * /api/patient/emergency-alerts:
 *   post:
 *     tags: [Patient Emergency Alerts]
 *     summary: Create an Emergency Alert
 *     description: Creates a HIGH priority alert for the authenticated Patient with status PENDING_ASSIGNMENT. The Patient identity is derived from the access token.
 *     operationId: createPatientEmergencyAlert
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 30
 *               location:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Maximum 65535 UTF-8 bytes.
 *           example:
 *             phone: '0591234567'
 *             location: Gaza
 *             description: Urgent medical assistance is needed.
 *     responses:
 *       '201':
 *         description: Emergency Alert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alert created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergency_alert:
 *                       $ref: '#/components/schemas/EmergencyAlert'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not a Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   get:
 *     tags: [Patient Emergency Alerts]
 *     summary: List own Emergency Alerts
 *     description: Returns all Emergency Alerts belonging to the authenticated Patient.
 *     operationId: listOwnEmergencyAlerts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Emergency Alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alerts retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergency_alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EmergencyAlert'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not a Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/patient/emergency-alerts/{alertId}:
 *   get:
 *     tags: [Patient Emergency Alerts]
 *     summary: Get own Emergency Alert
 *     description: Returns an Emergency Alert only when it belongs to the authenticated Patient.
 *     operationId: getOwnEmergencyAlert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Emergency Alert retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alert retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergency_alert:
 *                       $ref: '#/components/schemas/EmergencyAlert'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not a Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or own Emergency Alert not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/emergency-alerts/{alertId}/cancel:
 *   patch:
 *     tags: [Patient Emergency Alerts]
 *     summary: Cancel own Emergency Alert
 *     description: Cancels the Patient's alert only while its status is PENDING_ASSIGNMENT. Send an empty JSON object or omit the body.
 *     operationId: cancelOwnEmergencyAlert
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             maxProperties: 0
 *     responses:
 *       '200':
 *         description: Emergency Alert cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alert cancelled successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergency_alert:
 *                       $ref: '#/components/schemas/EmergencyAlert'
 *       '400':
 *         description: Invalid ID, non-empty request body, or alert is no longer pending assignment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not a Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or own Emergency Alert not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
