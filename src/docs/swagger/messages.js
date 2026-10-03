/**
 * @openapi
 * /api/messages:
 *   post:
 *     tags: [Messages]
 *     summary: Send Message
 *     description: Sends a message between one Patient and one Doctor. The pair must have an ACTIVE Doctor-Patient Assignment. Message text is trimmed and limited to 65535 UTF-8 bytes; client sender IDs and read fields are not accepted.
 *     operationId: sendMessage
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [receiver_id, message_text]
 *             properties:
 *               receiver_id: { type: integer, minimum: 1 }
 *               message_text: { type: string, minLength: 1, description: Must not be whitespace-only; maximum 65535 UTF-8 bytes. }
 *     responses:
 *       '201':
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Message sent successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { $ref: '#/components/schemas/Message' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, role is not PATIENT or DOCTOR, recipient is not the opposite role, or an ACTIVE assignment is required
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Recipient user or messaging participant profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/messages/conversations:
 *   get:
 *     tags: [Messages]
 *     summary: List Conversations
 *     description: Returns one summary per conversation involving the authenticated user, newest message first. No conversation is returned until at least one message exists.
 *     operationId: listConversations
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Conversations retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversations:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Conversation' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or role is not PATIENT or DOCTOR
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/messages/conversations/{userId}:
 *   get:
 *     tags: [Messages]
 *     summary: Get Conversation History
 *     description: Returns messages exchanged between the authenticated user and the specified Patient or Doctor, ordered oldest first. Existing conversation history is required; the ACTIVE assignment requirement governs new messages.
 *     operationId: getConversationHistory
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         description: Other conversation participant's user ID.
 *     responses:
 *       '200':
 *         description: Conversation history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Conversation history retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Message' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, role is not PATIENT or DOCTOR, or no conversation exists between the users
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Other user does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/messages/{messageId}/read:
 *   patch:
 *     tags: [Messages]
 *     summary: Mark Message as Read
 *     description: Only the message receiver may mark it as read. Repeating the operation for an already-read message succeeds and returns its current record. The request body must be an empty JSON object.
 *     operationId: markMessageRead
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, maxProperties: 0 }
 *     responses:
 *       '200':
 *         description: Message marked as read successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Message marked as read successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { $ref: '#/components/schemas/Message' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive, role is not PATIENT or DOCTOR, or the authenticated user is not the message receiver
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
