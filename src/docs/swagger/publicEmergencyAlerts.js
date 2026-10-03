/**
 * @openapi
 * /api/emergency-alerts:
 *   post:
 *     tags: [Public Emergency Alerts]
 *     summary: Create public Emergency Alert
 *     description: Creates an Emergency Alert for a visitor without requiring authentication. The visitor's phone is required; patient_id remains null, priority is HIGH, and initial status is PENDING_ASSIGNMENT.
 *     operationId: createPublicEmergencyAlert
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [phone]
 *             properties:
 *               phone: { type: string, minLength: 1, maxLength: 30 }
 *               location: { type: string, nullable: true, maxLength: 255 }
 *               description: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
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
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Emergency Alert created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     emergency_alert: { $ref: '#/components/schemas/EmergencyAlert' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
