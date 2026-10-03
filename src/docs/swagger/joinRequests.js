/**
 * @openapi
 * /api/admin/join-requests:
 *   get:
 *     tags:
 *       - Join Requests
 *     summary: List pending Join Requests
 *     description: >
 *       Returns all pending Doctor and NGO Join Requests.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: listPendingJoinRequests
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Pending join requests retrieved successfully
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
 *                   example: Pending join requests retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [join_requests]
 *                   properties:
 *                     join_requests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/JoinRequest'
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
 * /api/admin/join-requests/{id}:
 *   get:
 *     tags:
 *       - Join Requests
 *     summary: Get Join Request by ID
 *     description: >
 *       Returns a single Doctor or NGO Join Request by ID.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: getJoinRequest
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Join Request ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     responses:
 *       '200':
 *         description: Join request retrieved successfully
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
 *                   example: Join request retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [join_request]
 *                   properties:
 *                     join_request:
 *                       $ref: '#/components/schemas/JoinRequest'
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
 *         description: Join Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Join request not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/join-requests/{id}/approve:
 *   patch:
 *     tags:
 *       - Join Requests
 *     summary: Approve Join Request
 *     description: >
 *       Approves a pending Doctor or NGO Join Request and activates the
 *       associated user account. The request must still be PENDING and its
 *       user data must be consistent with the request type.
 *       No request body fields are accepted.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: approveJoinRequest
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Join Request ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             maxProperties: 0
 *             additionalProperties: false
 *           example: {}
 *
 *     responses:
 *       '200':
 *         description: Join request approved successfully
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
 *                   example: Join request approved successfully
 *                 data:
 *                   type: object
 *                   required: [join_request]
 *                   properties:
 *                     join_request:
 *                       $ref: '#/components/schemas/JoinRequest'
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
 *         description: Join Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Join request not found
 *       '409':
 *         description: Join Request was already reviewed or its data is inconsistent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alreadyReviewed:
 *                 summary: Join Request was already reviewed
 *                 value:
 *                   success: false
 *                   message: Join request has already been reviewed
 *               inconsistentData:
 *                 summary: Join Request data is inconsistent
 *                 value:
 *                   success: false
 *                   message: Join request data is inconsistent
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/join-requests/{id}/reject:
 *   patch:
 *     tags:
 *       - Join Requests
 *     summary: Reject Join Request
 *     description: >
 *       Rejects a pending Doctor or NGO Join Request.
 *       A non-empty rejection_reason is required and may contain up to
 *       500 characters. The request must still be PENDING and its user
 *       data must be consistent with the request type.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: rejectJoinRequest
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Join Request ID.
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
 *               - rejection_reason
 *             additionalProperties: false
 *             properties:
 *               rejection_reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: Registration information could not be verified.
 *
 *     responses:
 *       '200':
 *         description: Join request rejected successfully
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
 *                   example: Join request rejected successfully
 *                 data:
 *                   type: object
 *                   required: [join_request]
 *                   properties:
 *                     join_request:
 *                       $ref: '#/components/schemas/JoinRequest'
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
 *         description: Join Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Join request not found
 *       '409':
 *         description: Join Request was already reviewed or its data is inconsistent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alreadyReviewed:
 *                 summary: Join Request was already reviewed
 *                 value:
 *                   success: false
 *                   message: Join request has already been reviewed
 *               inconsistentData:
 *                 summary: Join Request data is inconsistent
 *                 value:
 *                   success: false
 *                   message: Join request data is inconsistent
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
