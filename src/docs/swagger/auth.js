/**
 * @openapi
 * /api/auth/register/patient:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new patient
 *     description: >
 *       Creates a new patient account. Patient accounts are activated
 *       immediately after successful registration.
 *     operationId: registerPatient
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegistrationCommonFields'
 *               - type: object
 *                 required:
 *                   - national_id
 *                   - date_of_birth
 *                   - gender
 *                 properties:
 *                   national_id:
 *                     type: string
 *                     pattern: '^[1-9][0-9]{8}$'
 *                     description: Palestinian national ID. Must contain exactly 9 digits and must not start with 0.
 *                     example: '123456789'
 *                   date_of_birth:
 *                     type: string
 *                     format: date
 *                     description: Valid date in YYYY-MM-DD format. Must not be in the future.
 *                     example: '2002-05-15'
 *                   gender:
 *                     type: string
 *                     enum:
 *                       - MALE
 *                       - FEMALE
 *                     example: MALE
 *                   address:
 *                     type: string
 *                     maxLength: 255
 *                     example: Gaza, Palestine
 *
 *     responses:
 *       '201':
 *         description: Patient registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Patient registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     patient:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         user_id:
 *                           type: integer
 *                           example: 1
 *                         national_id:
 *                           type: string
 *                           example: '123456789'
 *                         date_of_birth:
 *                           type: string
 *                           format: date
 *                           example: '2002-05-15'
 *                         gender:
 *                           type: string
 *                           enum:
 *                             - MALE
 *                             - FEMALE
 *                         address:
 *                           type: string
 *                           nullable: true
 *                           example: Gaza, Palestine
 *
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *
 *       '409':
 *         description: Email or national ID already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               duplicateEmail:
 *                 summary: Duplicate email
 *                 value:
 *                   success: false
 *                   message: An account with this email already exists
 *               duplicateNationalId:
 *                 summary: Duplicate national ID
 *                 value:
 *                   success: false
 *                   message: A patient with this national ID already exists
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /api/auth/register/doctor:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new doctor
 *     description: >
 *       Creates a new doctor account. Doctor accounts are created with
 *       INACTIVE status and require approval before they can authenticate
 *       as an active user.
 *     operationId: registerDoctor
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegistrationCommonFields'
 *               - type: object
 *                 required:
 *                   - specialization
 *                   - license_number
 *                 properties:
 *                   specialization:
 *                     type: string
 *                     maxLength: 100
 *                     description: Doctor medical specialization.
 *                     example: General Medicine
 *                   license_number:
 *                     type: string
 *                     maxLength: 100
 *                     description: Doctor professional license number.
 *                     example: MED-2026-001
 *
 *     responses:
 *       '201':
 *         description: Doctor registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Doctor registered successfully
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *
 *       '409':
 *         description: Email or license number already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               duplicateEmail:
 *                 summary: Duplicate email
 *                 value:
 *                   success: false
 *                   message: An account with this email already exists
 *               duplicateLicenseNumber:
 *                 summary: Duplicate license number
 *                 value:
 *                   success: false
 *                   message: A doctor with this license number already exists
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /api/auth/register/ngo:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new NGO
 *     description: >
 *       Creates a new NGO account. NGO accounts are created with
 *       INACTIVE status and require approval before they can authenticate
 *       as an active user.
 *     operationId: registerNgo
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegistrationCommonFields'
 *               - type: object
 *                 required:
 *                   - organization_name
 *                 properties:
 *                   organization_name:
 *                     type: string
 *                     maxLength: 150
 *                     description: Official name of the organization.
 *                     example: Gaza Medical Relief
 *                   registration_number:
 *                     type: string
 *                     nullable: true
 *                     maxLength: 100
 *                     description: Optional NGO registration number.
 *                     example: NGO-2026-001
 *                   address:
 *                     type: string
 *                     nullable: true
 *                     maxLength: 255
 *                     example: Gaza, Palestine
 *
 *     responses:
 *       '201':
 *         description: NGO registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: NGO registered successfully
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *
 *       '409':
 *         description: Email or registration number already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               duplicateEmail:
 *                 summary: Duplicate email
 *                 value:
 *                   success: false
 *                   message: An account with this email already exists
 *               duplicateRegistrationNumber:
 *                 summary: Duplicate registration number
 *                 value:
 *                   success: false
 *                   message: An NGO with this registration number already exists
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login
 *     description: Authenticates a user using email and password and returns a JWT access token.
 *     operationId: login
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 example: ahmed@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password1
 *
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT access token.
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *
 *       '401':
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Invalid email or password
 *
 *       '403':
 *         description: Credentials are valid but the account is inactive. For Doctor/NGO applicants with a pending or rejected Join Request, the response includes application status without issuing a token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Account is not active
 *                 data:
 *                   type: object
 *                   properties:
 *                     application:
 *                       type: object
 *                       required: [request_type, status, rejection_reason, submitted_at, reviewed_at]
 *                       properties:
 *                         request_type:
 *                           type: string
 *                           enum: [DOCTOR, NGO]
 *                         status:
 *                           type: string
 *                           enum: [PENDING, REJECTED]
 *                         rejection_reason:
 *                           type: string
 *                           nullable: true
 *                           maxLength: 500
 *                         submitted_at:
 *                           type: string
 *                           format: date-time
 *                         reviewed_at:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *             examples:
 *               pending:
 *                 summary: Application is pending review
 *                 value:
 *                   success: false
 *                   message: Account is not active
 *                   data:
 *                     application:
 *                       request_type: DOCTOR
 *                       status: PENDING
 *                       rejection_reason: null
 *                       submitted_at: '2026-10-08T09:30:00.000Z'
 *                       reviewed_at: null
 *               rejected:
 *                 summary: Application was rejected
 *                 value:
 *                   success: false
 *                   message: Account is not active
 *                   data:
 *                     application:
 *                       request_type: NGO
 *                       status: REJECTED
 *                       rejection_reason: Registration information could not be verified.
 *                       submitted_at: '2026-10-01T09:30:00.000Z'
 *                       reviewed_at: '2026-10-08T09:30:00.000Z'
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current authenticated user
 *     description: >
 *       Returns the currently authenticated user's public account information.
 *       Requires a valid JWT access token and an ACTIVE account.
 *     operationId: getCurrentUser
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Current user retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Current user retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *
 *       '403':
 *         $ref: '#/components/responses/AccountNotActive'
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
