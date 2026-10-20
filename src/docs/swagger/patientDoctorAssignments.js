/**
 * @openapi
 * /api/patient/doctor-assignments:
 *   get:
 *     tags: [Patient Intake and Care Coordination]
 *     summary: List the authenticated Patient's active Doctor assignments
 *     description: >
 *       Returns only the authenticated Patient's ACTIVE assignments, ordered
 *       by assigned_at descending and then ID descending. Requires an ACTIVE
 *       PATIENT account.
 *     operationId: listOwnPatientDoctorAssignments
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Patient Doctor assignments retrieved successfully
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
 *                   example: Patient doctor assignments retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [assignments]
 *                   properties:
 *                     assignments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - id
 *                           - status
 *                           - assigned_at
 *                           - doctor_id
 *                           - doctor_name
 *                           - specialization
 *                         properties:
 *                           id:
 *                             type: integer
 *                             format: int64
 *                             example: 12
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE]
 *                             example: ACTIVE
 *                           assigned_at:
 *                             type: string
 *                             format: date-time
 *                           doctor_id:
 *                             type: integer
 *                             format: int64
 *                             example: 4
 *                           doctor_name:
 *                             type: string
 *                             example: Dr. Example
 *                           specialization:
 *                             type: string
 *                             example: General Medicine
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
 */
