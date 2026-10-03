/**
 * @openapi
 * /api/admin/emergency-alerts:
 *   get:
 *     tags:
 *       - Emergency Alerts
 *     summary: List Emergency Alerts
 *     description: >
 *       Returns all Emergency Alerts ordered by sent_at descending,
 *       then by ID descending.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: listEmergencyAlertsForAdmin
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Emergency Alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alerts retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [emergency_alerts]
 *                   properties:
 *                     emergency_alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EmergencyAlert'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not an Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/emergency-alerts/{alertId}:
 *   get:
 *     tags:
 *       - Emergency Alerts
 *     summary: Get Emergency Alert by ID
 *     description: >
 *       Returns a single Emergency Alert by ID.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: getEmergencyAlertForAdmin
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         description: Emergency Alert ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     responses:
 *       '200':
 *         description: Emergency Alert retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alert retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [emergency_alert]
 *                   properties:
 *                     emergency_alert:
 *                       $ref: '#/components/schemas/EmergencyAlert'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not an Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Emergency Alert not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Emergency Alert not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/emergency-alerts/{alertId}/assign:
 *   patch:
 *     tags:
 *       - Emergency Alerts
 *     summary: Assign Doctor to Emergency Alert
 *     description: >
 *       Assigns an eligible active Doctor to an Emergency Alert that is
 *       currently PENDING_ASSIGNMENT. Eligible Doctor specializations are
 *       General Medicine and Emergency Medicine. On success, the Emergency
 *       Alert status becomes ASSIGNED. The assignment also records the
 *       assigning Admin and assignment time.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: assignDoctorToEmergencyAlert
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         description: Emergency Alert ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctor_id
 *             additionalProperties: false
 *             properties:
 *               doctor_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 3
 *
 *     responses:
 *       '200':
 *         description: Emergency Alert assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Emergency Alert assigned successfully
 *                 data:
 *                   type: object
 *                   required: [emergency_alert]
 *                   properties:
 *                     emergency_alert:
 *                       $ref: '#/components/schemas/EmergencyAlert'
 *       '400':
 *         description: >
 *           Request validation failed or the selected Doctor is not eligible
 *           for Emergency Alert assignment.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidDoctorId:
 *                 summary: Invalid Doctor ID
 *                 value:
 *                   success: false
 *                   message: Validation failed
 *                   errors:
 *                     doctor_id: doctor_id must be a positive integer
 *               inactiveDoctor:
 *                 summary: Doctor account is not active
 *                 value:
 *                   success: false
 *                   message: Doctor account is not active
 *               ineligibleSpecialization:
 *                 summary: Doctor specialization is not eligible
 *                 value:
 *                   success: false
 *                   message: Doctor specialization is not eligible for Emergency Alert assignment
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not an Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Emergency Alert or Doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alertNotFound:
 *                 summary: Emergency Alert not found
 *                 value:
 *                   success: false
 *                   message: Emergency Alert not found
 *               doctorNotFound:
 *                 summary: Doctor not found
 *                 value:
 *                   success: false
 *                   message: Doctor not found
 *       '409':
 *         description: >
 *           Emergency Alert is no longer available for Doctor assignment.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notPending:
 *                 summary: Emergency Alert is not pending assignment
 *                 value:
 *                   success: false
 *                   message: Emergency Alert is not pending assignment
 *               concurrentAssignment:
 *                 summary: Emergency Alert was assigned concurrently
 *                 value:
 *                   success: false
 *                   message: Emergency Alert can no longer be assigned
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
