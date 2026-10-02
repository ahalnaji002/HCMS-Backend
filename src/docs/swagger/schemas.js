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
