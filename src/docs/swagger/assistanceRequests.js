/**
 * @openapi
 * /api/admin/assistance-requests:
 *   get:
 *     tags:
 *       - Assistance Requests
 *     summary: List Assistance Requests
 *     description: >
 *       Returns all Assistance Requests ordered by submitted_at descending,
 *       then by ID descending.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: listAssistanceRequestsForAdmin
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Assistance Requests retrieved successfully
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
 *                   example: Assistance Requests retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [assistance_requests]
 *                   properties:
 *                     assistance_requests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AssistanceRequest'
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
 * /api/admin/assistance-requests/{requestId}:
 *   get:
 *     tags:
 *       - Assistance Requests
 *     summary: Get Assistance Request by ID
 *     description: >
 *       Returns a single Assistance Request by ID.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: getAssistanceRequestForAdmin
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         description: Assistance Request ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     responses:
 *       '200':
 *         description: Assistance Request retrieved successfully
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
 *                   example: Assistance Request retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [assistance_request]
 *                   properties:
 *                     assistance_request:
 *                       $ref: '#/components/schemas/AssistanceRequest'
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
 *         description: Assistance Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Assistance Request not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/assistance-requests/{requestId}/assign:
 *   patch:
 *     tags:
 *       - Assistance Requests
 *     summary: Assign NGO to Assistance Request
 *     description: >
 *       Assigns an active NGO to a PENDING Assistance Request that has not
 *       already been assigned to an NGO.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: assignNgoToAssistanceRequest
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         description: Assistance Request ID.
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
 *               - ngo_id
 *             additionalProperties: false
 *             properties:
 *               ngo_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *
 *     responses:
 *       '200':
 *         description: Assistance Request assigned successfully
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
 *                   example: Assistance Request assigned successfully
 *                 data:
 *                   type: object
 *                   required: [assistance_request]
 *                   properties:
 *                     assistance_request:
 *                       $ref: '#/components/schemas/AssistanceRequest'
 *       '400':
 *         description: Validation failed or the NGO account is not eligible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidNgoId:
 *                 summary: Invalid NGO ID
 *                 value:
 *                   success: false
 *                   message: Validation failed
 *                   errors:
 *                     ngo_id: ngo_id must be a positive integer
 *               inactiveNgo:
 *                 summary: NGO account is not active
 *                 value:
 *                   success: false
 *                   message: NGO must have an active NGO user account
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not an Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Assistance Request or NGO not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               requestNotFound:
 *                 summary: Assistance Request not found
 *                 value:
 *                   success: false
 *                   message: Assistance Request not found
 *               ngoNotFound:
 *                 summary: NGO not found
 *                 value:
 *                   success: false
 *                   message: NGO not found
 *       '409':
 *         description: Assistance Request is not available for assignment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Assistance Request is not available for assignment
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
