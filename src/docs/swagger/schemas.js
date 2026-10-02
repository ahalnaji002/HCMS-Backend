/**
 * @openapi
 * components:
 *   schemas:
 *
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         full_name:
 *           type: string
 *           maxLength: 150
 *           example: Ahmed Alnaji
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: ahmed@example.com
 *         role:
 *           type: string
 *           enum: [PATIENT, DOCTOR, NGO, ADMIN]
 *           example: PATIENT
 *         account_status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: ACTIVE
 *         phone:
 *           type: string
 *           nullable: true
 *           pattern: '^(059|056)[0-9]{7}$'
 *           example: '0591234567'
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     PatientProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           required:
 *             - national_id
 *             - date_of_birth
 *             - gender
 *           properties:
 *             national_id:
 *               type: string
 *               pattern: '^[1-9][0-9]{8}$'
 *               description: Palestinian national ID. Must contain exactly 9 digits and must not start with 0.
 *               example: '123456789'
 *             date_of_birth:
 *               type: string
 *               format: date
 *               example: '2002-05-15'
 *             gender:
 *               type: string
 *               enum: [MALE, FEMALE]
 *               example: MALE
 *             address:
 *               type: string
 *               nullable: true
 *               maxLength: 255
 *               example: Gaza, Palestine
 *
 *     DoctorProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           required:
 *             - specialization
 *             - license_number
 *           properties:
 *             specialization:
 *               type: string
 *               maxLength: 100
 *               example: General Medicine
 *             license_number:
 *               type: string
 *               maxLength: 100
 *               example: MED-2026-001
 *
 *     NgoProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           required:
 *             - organization_name
 *           properties:
 *             organization_name:
 *               type: string
 *               maxLength: 150
 *               example: Gaza Medical Relief
 *             registration_number:
 *               type: string
 *               nullable: true
 *               maxLength: 100
 *               example: NGO-2026-001
 *             address:
 *               type: string
 *               nullable: true
 *               maxLength: 255
 *               example: Gaza, Palestine
 *             contact_phone:
 *               type: string
 *               nullable: true
 *               pattern: '^(059|056)[0-9]{7}$'
 *               example: '0591234567'
 *
 *     AdminProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *
 *     RegistrationCommonFields:
 *       type: object
 *       required:
 *         - full_name
 *         - email
 *         - password
 *         - password_confirmation
 *       properties:
 *         full_name:
 *           type: string
 *           maxLength: 150
 *           example: Ahmed Alnaji
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: ahmed@example.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: Must contain at least one uppercase letter, one lowercase letter, and one digit. Maximum 72 UTF-8 bytes.
 *           example: Password1
 *         password_confirmation:
 *           type: string
 *           format: password
 *           description: Must exactly match password. Used for validation only and is never stored.
 *           example: Password1
 *         phone:
 *           type: string
 *           nullable: true
 *           pattern: '^(059|056)[0-9]{7}$'
 *           description: Optional Palestinian mobile number. Must be exactly 10 digits and start with 059 or 056.
 *           example: '0591234567'
 *
 *     ValidationError:
 *       type: object
 *       required:
 *         - success
 *         - message
 *         - errors
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Validation failed
 *         errors:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           example:
 *             email: email must be a valid email address
 *
 *     ErrorResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Internal server error
 *
 *   responses:
 *
 *     ValidationError:
 *       description: Request validation failed
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidationError'
 *
 *     AuthenticationRequired:
 *       description: Authentication is required or the supplied token is invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: Authentication required
 *
 *     AccountNotActive:
 *       description: The authenticated account is not active
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: Account is not active
 *
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: Internal server error
 */
