/**
 * @openapi
 * /api/admin/assistance-requests/{requestId}/resources:
 *   get:
 *     tags:
 *       - Resource Allocations
 *     summary: List Resource Allocations for Assistance Request
 *     description: >
 *       Returns all Resource Allocations belonging to the specified
 *       Assistance Request, ordered by created_at ascending and then by
 *       ID ascending.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: listResourceAllocationsForAdmin
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
 *         description: Resource Allocations retrieved successfully
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
 *                   example: Resource Allocations retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [resource_allocations]
 *                   properties:
 *                     resource_allocations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ResourceAllocation'
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
 */
