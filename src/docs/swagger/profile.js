/**
 * @openapi
 * /api/profile:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Get own profile
 *     description: >
 *       Returns the authenticated user's profile. The returned profile shape
 *       depends on whether the current user is a Patient, Doctor, NGO, or Admin.
 *     operationId: getOwnProfile
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Profile retrieved successfully
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
 *                   example: Profile retrieved successfully
 *                 data:
 *                   type: object
 *                   required:
 *                     - profile
 *                   properties:
 *                     profile:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/PatientProfile'
 *                         - $ref: '#/components/schemas/DoctorProfile'
 *                         - $ref: '#/components/schemas/NgoProfile'
 *                         - $ref: '#/components/schemas/AdminProfile'
 *
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *
 *       '403':
 *         $ref: '#/components/responses/AccountNotActive'
 *
 *       '404':
 *         description: Role-specific profile was not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               patientProfileNotFound:
 *                 summary: Patient profile not found
 *                 value:
 *                   success: false
 *                   message: Patient profile not found
 *               doctorProfileNotFound:
 *                 summary: Doctor profile not found
 *                 value:
 *                   success: false
 *                   message: Doctor profile not found
 *               ngoProfileNotFound:
 *                 summary: NGO profile not found
 *                 value:
 *                   success: false
 *                   message: NGO profile not found
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 *   patch:
 *     tags:
 *       - Profile
 *     summary: Update own profile
 *     description: >
 *       Updates approved self-service profile fields. Patients may update
 *       full_name, phone, date_of_birth, gender, and address. Doctors may
 *       update only full_name and phone. NGO and Admin accounts cannot use
 *       this endpoint.
 *     operationId: updateOwnProfile
 *
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               full_name:
 *                 type: string
 *                 maxLength: 150
 *                 description: Available to Patient and Doctor accounts.
 *                 example: Ahmed Alnaji
 *               phone:
 *                 type: string
 *                 nullable: true
 *                 pattern: '^(059|056)[0-9]{7}$'
 *                 description: >
 *                   Available to Patient and Doctor accounts. Must be exactly
 *                   10 digits and start with 059 or 056, or may be null.
 *                 example: '0591234567'
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 description: >
 *                   Patient only. Must be a valid date in YYYY-MM-DD format
 *                   and must not be in the future.
 *                 example: '2002-05-15'
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE]
 *                 description: Patient only.
 *                 example: MALE
 *               address:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 255
 *                 description: Patient only.
 *                 example: Gaza, Palestine
 *             additionalProperties: false
 *
 *     responses:
 *       '200':
 *         description: Profile updated successfully
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
 *                   example: Profile updated successfully
 *                 data:
 *                   type: object
 *                   required:
 *                     - profile
 *                   properties:
 *                     profile:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/PatientProfile'
 *                         - $ref: '#/components/schemas/DoctorProfile'
 *
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *
 *       '403':
 *         description: Account is inactive or the authenticated role is not allowed to update its profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               accountNotActive:
 *                 summary: Account is inactive
 *                 value:
 *                   success: false
 *                   message: Account is not active
 *               forbidden:
 *                 summary: Role is not allowed
 *                 value:
 *                   success: false
 *                   message: Forbidden
 *
 *       '404':
 *         description: Patient or Doctor profile was not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               patientProfileNotFound:
 *                 value:
 *                   success: false
 *                   message: Patient profile not found
 *               doctorProfileNotFound:
 *                 value:
 *                   success: false
 *                   message: Doctor profile not found
 *
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
