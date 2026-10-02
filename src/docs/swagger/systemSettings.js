/**
 * @openapi
 * /api/admin/settings:
 *   get:
 *     tags:
 *       - System Settings
 *     summary: List System Settings
 *     description: Returns all approved System Settings. Requires an ACTIVE ADMIN account.
 *     operationId: listSystemSettings
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: System Settings retrieved successfully
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
 *                   example: System Settings retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [settings]
 *                   properties:
 *                     settings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SystemSetting'
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
 * /api/admin/settings/{key}:
 *   get:
 *     tags:
 *       - System Settings
 *     summary: Get System Setting by key
 *     description: Returns a single approved System Setting. Requires an ACTIVE ADMIN account.
 *     operationId: getSystemSetting
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - system_name
 *             - support_email
 *             - support_phone
 *         description: Approved System Setting key.
 *
 *     responses:
 *       '200':
 *         description: System Setting retrieved successfully
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
 *                   example: System Setting retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [setting]
 *                   properties:
 *                     setting:
 *                       $ref: '#/components/schemas/SystemSetting'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or the authenticated user is not an Admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: System Setting not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: System Setting not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 *   patch:
 *     tags:
 *       - System Settings
 *     summary: Update System Setting
 *     description: >
 *       Updates an approved System Setting. Requires an ACTIVE ADMIN account.
 *       system_name requires a non-empty string up to 100 characters.
 *       support_email accepts null or a valid email address up to 255 characters.
 *       support_phone accepts null or a Palestinian mobile number containing exactly
 *       10 digits and starting with 059 or 056.
 *     operationId: updateSystemSetting
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - system_name
 *             - support_email
 *             - support_phone
 *         description: Approved System Setting key.
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_value
 *             additionalProperties: false
 *             properties:
 *               setting_value:
 *                 type: string
 *                 nullable: true
 *           examples:
 *             systemName:
 *               summary: Update system name
 *               value:
 *                 setting_value: Healthcare Conflict Management System
 *             supportEmail:
 *               summary: Update support email
 *               value:
 *                 setting_value: support@example.com
 *             supportPhone:
 *               summary: Update support phone
 *               value:
 *                 setting_value: '0591234567'
 *             clearNullableSetting:
 *               summary: Clear a nullable setting
 *               value:
 *                 setting_value: null
 *
 *     responses:
 *       '200':
 *         description: System Setting updated successfully
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
 *                   example: System Setting updated successfully
 *                 data:
 *                   type: object
 *                   required: [setting]
 *                   properties:
 *                     setting:
 *                       $ref: '#/components/schemas/SystemSetting'
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
 *         description: System Setting not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: System Setting not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
