/**
 * @openapi
 * /api/patient/assistance-requests:
 *   get:
 *     tags: [Assistance Requests]
 *     summary: List own Assistance Requests
 *     description: Returns Assistance Requests submitted for the authenticated Patient.
 *     operationId: listOwnAssistanceRequests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Assistance Requests retrieved successfully
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
 *                   example: Assistance Requests retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     assistance_requests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AssistanceRequest'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
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
 * /api/patient/assistance-requests/{requestId}:
 *   get:
 *     tags: [Assistance Requests]
 *     summary: Get own Assistance Request
 *     description: Returns an Assistance Request only when it belongs to the authenticated Patient.
 *     operationId: getOwnAssistanceRequest
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Assistance Request retrieved successfully
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
 *                   example: Assistance Request retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     assistance_request:
 *                       $ref: '#/components/schemas/AssistanceRequest'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or own Assistance Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/assistance-requests/{requestId}/resources:
 *   get:
 *     tags: [Resource Allocations]
 *     summary: List resources for own Assistance Request
 *     description: Returns resource allocations for an Assistance Request owned by the authenticated Patient.
 *     operationId: listPatientAssistanceRequestResources
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Resource Allocations retrieved successfully
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
 *                   example: Resource Allocations retrieved successfully
 *                 data:
 *                   type: object
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
 *         description: Account is inactive, role is not PATIENT, or request belongs to another Patient
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
