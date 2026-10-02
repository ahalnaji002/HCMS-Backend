/**
 * @openapi
 * /api/patient/reminders:
 *   post:
 *     tags: [Patient Reminders]
 *     summary: Create a Reminder
 *     description: Creates a reminder for one of the authenticated Patient's own Treatment Medications or Appointments.
 *     operationId: createReminder
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [type, reference_id, remind_at]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [MEDICATION, APPOINTMENT]
 *               reference_id:
 *                 type: integer
 *                 minimum: 1
 *               remind_at:
 *                 type: string
 *                 pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$'
 *                 description: Valid future local datetime in YYYY-MM-DDTHH:mm:ss format, without timezone offset.
 *           example:
 *             type: MEDICATION
 *             reference_id: 12
 *             remind_at: '2026-10-15T09:30:00'
 *     responses:
 *       '201':
 *         description: Reminder created successfully
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
 *                   example: Reminder created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     reminder:
 *                       $ref: '#/components/schemas/Reminder'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive, role is not PATIENT, or the referenced plan belongs to another Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or reminder reference not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   get:
 *     tags: [Patient Reminders]
 *     summary: List own Reminders
 *     description: Returns reminders belonging to the authenticated Patient, ordered by remind_at and then ID ascending.
 *     operationId: listOwnReminders
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Reminders retrieved successfully
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
 *                   example: Reminders retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     reminders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Reminder'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/patient/reminders/{reminderId}:
 *   get:
 *     tags: [Patient Reminders]
 *     summary: Get own Reminder
 *     description: Returns a Reminder belonging to the authenticated Patient.
 *     operationId: getOwnReminder
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reminderId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Reminder retrieved successfully
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
 *                   example: Reminder retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     reminder:
 *                       $ref: '#/components/schemas/Reminder'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Reminder not found for the authenticated Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/reminders/{reminderId}/cancel:
 *   patch:
 *     tags: [Patient Reminders]
 *     summary: Cancel own Reminder
 *     description: Cancels a Reminder only while its status is PENDING. The request body must be an empty JSON object.
 *     operationId: cancelOwnReminder
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reminderId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             maxProperties: 0
 *     responses:
 *       '200':
 *         description: Reminder cancelled successfully
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
 *                   example: Reminder cancelled successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     reminder:
 *                       $ref: '#/components/schemas/Reminder'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Reminder not found for the authenticated Patient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: Only a PENDING Reminder can be cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
