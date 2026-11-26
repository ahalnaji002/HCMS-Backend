/**
 * @openapi
 * components:
 *   schemas:
 *     ManagedUser:
 *       type: object
 *       description: User account as seen by an Administrator. Never includes the password hash.
 *       properties:
 *         id: { type: integer, example: 12 }
 *         full_name: { type: string, example: Sara Ahmad }
 *         email: { type: string, format: email }
 *         role: { type: string, enum: [PATIENT, DOCTOR, NGO, ADMIN] }
 *         account_status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *           description: INACTIVE means a Doctor or NGO applicant awaiting or rejected by Join Request review. SUSPENDED means deactivated by an Administrator.
 *         phone: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     ManagedNgo:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 3 }
 *         user_id: { type: integer, example: 15 }
 *         organization_name: { type: string }
 *         registration_number: { type: string, nullable: true }
 *         address: { type: string, nullable: true }
 *         contact_phone: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         full_name: { type: string, description: Account holder name }
 *         email: { type: string, format: email }
 *         phone: { type: string, nullable: true }
 *         account_status: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED] }
 *         assigned_requests: { type: integer, description: Assistance Requests ever assigned to this NGO }
 *         open_requests: { type: integer, description: 'Assigned requests in PENDING, UNDER_REVIEW, or APPROVED' }
 *         completed_requests: { type: integer }
 * /api/admin/users:
 *   get:
 *     tags: [User Management]
 *     summary: List user accounts (FR-10.1)
 *     description: Newest accounts first. Requires an ACTIVE ADMIN account.
 *     operationId: listUsersForAdmin
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [PATIENT, DOCTOR, NGO, ADMIN] }
 *       - in: query
 *         name: account_status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED] }
 *       - in: query
 *         name: search
 *         description: Matches name, email, or phone (up to 100 characters).
 *         schema: { type: string, maxLength: 100 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Users retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users: { type: array, items: { $ref: '#/components/schemas/ManagedUser' } }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     total_pages: { type: integer }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or user is not an Admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/admin/users/{userId}/status:
 *   patch:
 *     tags: [User Management]
 *     summary: Activate or deactivate a user account (FR-10.1)
 *     description: >
 *       SUSPENDED deactivates an ACTIVE account and ACTIVE re-activates a SUSPENDED one.
 *       Applicants (INACTIVE) are activated through Join Requests only. An Administrator
 *       cannot change their own account or deactivate the last active Administrator.
 *       The change applies from the user's next request and is recorded in the Activity Log
 *       as ACTIVATE_USER or DEACTIVATE_USER.
 *     operationId: updateUserAccountStatus
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [account_status]
 *             properties:
 *               account_status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *     responses:
 *       '200':
 *         description: User account status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: User account status updated successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/ManagedUser' }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or user is not an Admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '409':
 *         description: Own account, last active Administrator, applicant awaiting approval, or status already set
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 * /api/admin/ngos:
 *   get:
 *     tags: [User Management]
 *     summary: List NGOs with account status and assigned request counts (FR-10.2)
 *     operationId: listNgosForAdmin
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: account_status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED] }
 *       - in: query
 *         name: search
 *         description: Matches organization name, registration number, or email.
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       '200':
 *         description: NGOs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: NGOs retrieved successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     ngos: { type: array, items: { $ref: '#/components/schemas/ManagedNgo' } }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/AuthenticationRequired' }
 *       '403':
 *         description: Account is inactive or user is not an Admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
