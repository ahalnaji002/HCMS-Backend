/**
 * @openapi
 * /api/ngo/dashboard:
 *   get:
 *     tags: [NGO Dashboard]
 *     summary: Get NGO dashboard
 *     description: Returns counts of requests assigned to the authenticated NGO and resource allocation records on those requests.
 *     operationId: getNgoDashboard
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: NGO dashboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: NGO dashboard retrieved successfully }
 *                 data: { $ref: '#/components/schemas/NgoDashboard' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or user is not an NGO
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: NGO profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
