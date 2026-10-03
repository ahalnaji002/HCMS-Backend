/**
 * @openapi
 * /api/ngo/assistance-requests/{requestId}/resources:
 *   post:
 *     tags: [NGO Resource Allocations]
 *     summary: Create Resource Allocation
 *     description: Creates an allocation for a request assigned to this NGO. Creation is allowed only while request status is APPROVED; quantity must be a positive integer.
 *     operationId: createNgoResourceAllocation
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
 *             required: [resource_name, quantity]
 *             properties:
 *               resource_name: { type: string, minLength: 1, maxLength: 150 }
 *               quantity: { type: integer, minimum: 1, maximum: 4294967295 }
 *               delivery_date: { type: string, format: date, nullable: true }
 *               notes: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Resource Allocation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Resource Allocation created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     resource_allocation: { $ref: '#/components/schemas/ResourceAllocation' }
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
 *         description: Resource Allocations can only be created for an APPROVED request
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   get:
 *     tags: [NGO Resource Allocations]
 *     summary: List Resource Allocations
 *     description: Lists resources for an Assistance Request assigned to the authenticated NGO.
 *     operationId: listNgoResourceAllocations
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Resource Allocations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Resource Allocations retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     resource_allocations:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ResourceAllocation' }
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
 * /api/ngo/assistance-requests/{requestId}/resources/{resourceId}:
 *   patch:
 *     tags: [NGO Resource Allocations]
 *     summary: Update Resource Allocation
 *     description: Updates one or more supplied fields on a resource owned by the request. At least one editable field is required. Allocations are read-only after request completion.
 *     operationId: updateNgoResourceAllocation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: resourceId
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
 *               resource_name: { type: string, minLength: 1, maxLength: 150 }
 *               quantity: { type: integer, minimum: 1, maximum: 4294967295 }
 *               delivery_date: { type: string, format: date, nullable: true }
 *               notes: { type: string, nullable: true, description: Maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '200':
 *         description: Resource Allocation updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Resource Allocation updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     resource_allocation: { $ref: '#/components/schemas/ResourceAllocation' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not an NGO, or request is assigned to another NGO
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: NGO profile, Assistance Request, or Resource Allocation not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: Resource Allocation is read-only after request completion or changed concurrently
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 *   delete:
 *     tags: [NGO Resource Allocations]
 *     summary: Delete Resource Allocation
 *     description: Deletes a resource belonging to the specified request. Allocations cannot be modified after the request is completed.
 *     operationId: deleteNgoResourceAllocation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200':
 *         description: Resource Allocation deleted successfully; the deleted allocation is returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Resource Allocation deleted successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     resource_allocation: { $ref: '#/components/schemas/ResourceAllocation' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, user is not an NGO, or request is assigned to another NGO
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: NGO profile, Assistance Request, or Resource Allocation not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: Resource Allocations are read-only after request completion or the allocation changed concurrently
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
