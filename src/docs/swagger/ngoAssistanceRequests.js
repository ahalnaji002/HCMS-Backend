/**
 * @openapi
 * /api/ngo/assistance-requests:
 *   get:
 *     tags: [NGO Assistance Requests]
 *     summary: List assigned Assistance Requests
 *     description: Returns Assistance Requests assigned to the authenticated NGO, newest submitted first.
 *     operationId: listNgoAssistanceRequests
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Assistance Requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Assistance Requests retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     assistance_requests:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/AssistanceRequest' }
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
 * /api/ngo/assistance-requests/{requestId}:
 *   get:
 *     tags: [NGO Assistance Requests]
 *     summary: Get assigned Assistance Request
 *     description: Returns a request assigned to the authenticated NGO. A request assigned to another NGO is forbidden.
 *     operationId: getNgoAssistanceRequest
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Assistance Request retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Assistance Request retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     assistance_request: { $ref: '#/components/schemas/AssistanceRequest' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not an NGO, or request is assigned to another NGO
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: NGO profile or Assistance Request not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/ngo/assistance-requests/{requestId}/status:
 *   patch:
 *     tags: [NGO Assistance Requests]
 *     summary: Update Assistance Request status
 *     description: Updates the assigned request using the implemented workflow transitions PENDING to UNDER_REVIEW, UNDER_REVIEW to APPROVED or REJECTED, and APPROVED to COMPLETED. Completing a request requires at least one Resource Allocation.
 *     operationId: updateNgoAssistanceRequestStatus
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
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
 *               status: { type: string, enum: [PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED] }
 *     responses:
 *       '200':
 *         description: Assistance Request status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Assistance Request status updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     assistance_request: { $ref: '#/components/schemas/AssistanceRequest' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not an NGO, or request is assigned to another NGO
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: NGO profile or Assistance Request not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: Requested status transition is invalid or completion requirements are not met
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
