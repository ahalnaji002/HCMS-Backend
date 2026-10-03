/**
 * @openapi
 * /api/admin/activity-logs:
 *   get:
 *     tags:
 *       - Activity Logs
 *     summary: List Activity Logs
 *     description: >
 *       Returns paginated Activity Logs with optional filtering.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: listActivityLogs
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum:
 *             - APPROVE_JOIN_REQUEST
 *             - REJECT_JOIN_REQUEST
 *             - ASSIGN_EMERGENCY_ALERT
 *             - UPDATE_EMERGENCY_STATUS
 *             - CREATE_ASSISTANCE_REQUEST
 *             - UPDATE_ASSISTANCE_STATUS
 *             - CREATE_RESOURCE_ALLOCATION
 *             - UPDATE_RESOURCE_ALLOCATION
 *             - DELETE_RESOURCE_ALLOCATION
 *             - UPDATE_SYSTEM_SETTING
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *           enum:
 *             - JOIN_REQUEST
 *             - EMERGENCY_ALERT
 *             - ASSISTANCE_REQUEST
 *             - RESOURCE_ALLOCATION
 *             - SYSTEM_SETTING
 *       - in: query
 *         name: entity_id
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           example: '2026-09-01T00:00:00'
 *         description: Must use YYYY-MM-DDTHH:mm:ss format.
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           example: '2026-10-02T23:59:59'
 *         description: Must use YYYY-MM-DDTHH:mm:ss format and must not be before date_from.
 *
 *     responses:
 *       '200':
 *         description: Activity Logs retrieved successfully
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
 *                   example: Activity Logs retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [items, page, limit, total, total_pages]
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ActivityLog'
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 35
 *                     total_pages:
 *                       type: integer
 *                       example: 2
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/activity-logs/{logId}:
 *   get:
 *     tags:
 *       - Activity Logs
 *     summary: Get Activity Log by ID
 *     description: Returns a single Activity Log. Requires an ACTIVE ADMIN account.
 *     operationId: getActivityLog
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Activity Log ID.
 *
 *     responses:
 *       '200':
 *         description: Activity Log retrieved successfully
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
 *                   example: Activity Log retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [activity_log]
 *                   properties:
 *                     activity_log:
 *                       $ref: '#/components/schemas/ActivityLog'
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
 *         description: Activity Log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Activity Log not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
