/**
 * @openapi
 * /api/patient/dashboard:
 *   get:
 *     tags: [Patient Dashboard]
 *     summary: Get Patient dashboard
 *     description: Returns dashboard counts for the authenticated Patient. Requires an ACTIVE PATIENT account.
 *     operationId: getPatientDashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Patient dashboard retrieved successfully
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
 *                   example: Patient dashboard retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/PatientDashboard'
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
