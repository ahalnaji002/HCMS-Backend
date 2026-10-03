/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List own Notifications
 *     description: Returns notifications belonging only to the authenticated user, newest first. Any active authenticated role may call this endpoint.
 *     operationId: listOwnNotifications
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notifications retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Notification' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Authenticated account is inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread Notification count
 *     description: Returns the authenticated user's unread notification count. Any active authenticated role may call this endpoint.
 *     operationId: getUnreadNotificationCount
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Unread Notification count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Unread Notification count retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     unread_count: { type: integer, example: 3 }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Authenticated account is inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all own Notifications as read
 *     description: Marks all unread notifications belonging to the authenticated user as read and returns the number of rows updated. Requires an empty JSON object body; no role restriction is applied.
 *     operationId: markAllOwnNotificationsRead
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, maxProperties: 0 }
 *     responses:
 *       '200':
 *         description: Notifications marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notifications marked as read successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated_count: { type: integer, example: 4 }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Authenticated account is inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark own Notification as read
 *     description: Marks a notification belonging to the authenticated user as read. Repeating the operation is idempotent. Requires an empty JSON object body; no role restriction is applied.
 *     operationId: markOwnNotificationRead
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, maxProperties: 0 }
 *     responses:
 *       '200':
 *         description: Notification marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Notification marked as read successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     notification: { $ref: '#/components/schemas/Notification' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Authenticated account is inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Notification not found for the authenticated user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
