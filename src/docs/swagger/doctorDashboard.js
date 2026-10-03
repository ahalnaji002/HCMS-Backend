/**
 * @openapi
 * /api/doctor/dashboard:
 *   get:
 *     tags: [Doctor Dashboard]
 *     summary: Get Doctor dashboard
 *     operationId: getDoctorDashboard
 *     description: Returns metrics for the authenticated Doctor. Requires an ACTIVE DOCTOR account.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Doctor dashboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Doctor dashboard retrieved successfully }
 *                 data: { $ref: '#/components/schemas/DoctorDashboard' }
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
 */
