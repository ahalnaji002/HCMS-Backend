/**
 * @openapi
 * /api/doctor/treatment-plans/{planId}/appointments:
 *   post:
 *     tags: [Doctor Treatment Appointments]
 *     summary: Create Treatment Appointment
 *     description: Creates an appointment under an authorized Treatment Plan. appointment_date is a Palestinian local wall-clock time in Asia/Hebron, supplied as YYYY-MM-DD HH:mm:ss without a timezone suffix; its calendar date must fall within the plan's inclusive start_date/end_date range (when an end date exists).
 *     operationId: createTreatmentAppointment
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
 *             required: [appointment_date, purpose]
 *             properties:
 *               appointment_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$', example: '2026-10-15 10:30:00', description: 'Palestinian local wall-clock time in Asia/Hebron; YYYY-MM-DD HH:mm:ss with no timezone suffix.' }
 *               purpose: { type: string, minLength: 1, maxLength: 255 }
 *               location: { type: string, nullable: true, maxLength: 255 }
 *               notes: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Treatment Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Appointment created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointment: { $ref: '#/components/schemas/TreatmentAppointment' }
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
 *     tags: [Doctor Treatment Appointments]
 *     summary: List Treatment Appointments
 *     operationId: listTreatmentAppointments
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Appointments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Appointments retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointments:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/TreatmentAppointment' }
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
 * /api/doctor/treatment-plans/{planId}/appointments/{appointmentId}:
 *   get:
 *     tags: [Doctor Treatment Appointments]
 *     summary: Get Treatment Appointment
 *     operationId: getTreatmentAppointment
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Appointment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Appointment retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointment: { $ref: '#/components/schemas/TreatmentAppointment' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, Patient, or appointment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   patch:
 *     tags: [Doctor Treatment Appointments]
 *     summary: Update Treatment Appointment
 *     description: Requires at least one editable field. appointment_date uses the Asia/Hebron local wall-clock YYYY-MM-DD HH:mm:ss format without a timezone suffix. If changed, its calendar date must remain within the plan's inclusive date range.
 *     operationId: updateTreatmentAppointment
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: appointmentId
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
 *               appointment_date: { type: string, pattern: '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$', description: 'Palestinian local wall-clock time in Asia/Hebron; YYYY-MM-DD HH:mm:ss with no timezone suffix.' }
 *               purpose: { type: string, minLength: 1, maxLength: 255 }
 *               location: { type: string, nullable: true, maxLength: 255 }
 *               status: { type: string, enum: [SCHEDULED, COMPLETED, CANCELLED] }
 *               notes: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '200':
 *         description: Treatment Appointment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Appointment updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointment: { $ref: '#/components/schemas/TreatmentAppointment' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, Patient, or appointment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   delete:
 *     tags: [Doctor Treatment Appointments]
 *     summary: Delete Treatment Appointment
 *     description: Deletes an appointment belonging to the authorized Treatment Plan and returns the deleted record.
 *     operationId: deleteTreatmentAppointment
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Treatment Appointment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Treatment Appointment deleted successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointment: { $ref: '#/components/schemas/TreatmentAppointment' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not a Doctor, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Doctor profile, Treatment Plan, Patient, or appointment not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
