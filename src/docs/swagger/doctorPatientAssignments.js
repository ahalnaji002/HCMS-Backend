/**
 * @openapi
 * /api/admin/doctor-patient-assignments:
 *   get:
 *     tags:
 *       - Doctor-Patient Assignments
 *     summary: List Doctor-Patient Assignments
 *     description: >
 *       Returns all Doctor-Patient assignments ordered by assigned_at
 *       descending, then by ID descending.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: listDoctorPatientAssignments
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Doctor-patient assignments retrieved successfully
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
 *                   example: Doctor-patient assignments retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [assignments]
 *                   properties:
 *                     assignments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DoctorPatientAssignment'
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
 *   post:
 *     tags:
 *       - Doctor-Patient Assignments
 *     summary: Create Doctor-Patient Assignment
 *     description: >
 *       Creates an ACTIVE assignment between an existing active Doctor
 *       and an existing active Patient. Only one ACTIVE assignment may
 *       exist for the same Doctor-Patient pair.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: createDoctorPatientAssignment
 *     security:
 *       - bearerAuth: []
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctor_id
 *               - patient_id
 *               - assignment_reason
 *             additionalProperties: false
 *             properties:
 *               doctor_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 3
 *               patient_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 27
 *               assignment_reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: Patient requires follow-up care.
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 description: Optional notes. Maximum size is 65535 UTF-8 bytes.
 *                 example: Follow up with the patient regularly.
 *
 *     responses:
 *       '201':
 *         description: Doctor-patient assignment created successfully
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
 *                   example: Doctor-patient assignment created successfully
 *                 data:
 *                   type: object
 *                   required: [assignment]
 *                   properties:
 *                     assignment:
 *                       $ref: '#/components/schemas/DoctorPatientAssignment'
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
 *         description: Doctor or Patient not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               doctorNotFound:
 *                 summary: Doctor not found
 *                 value:
 *                   success: false
 *                   message: Doctor not found
 *               patientNotFound:
 *                 summary: Patient not found
 *                 value:
 *                   success: false
 *                   message: Patient not found
 *       '409':
 *         description: Doctor or Patient is inactive, or an ACTIVE assignment already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               doctorNotActive:
 *                 summary: Doctor account is not active
 *                 value:
 *                   success: false
 *                   message: Doctor account is not active
 *               patientNotActive:
 *                 summary: Patient account is not active
 *                 value:
 *                   success: false
 *                   message: Patient account is not active
 *               activeAssignmentExists:
 *                 summary: ACTIVE assignment already exists
 *                 value:
 *                   success: false
 *                   message: An active assignment already exists for this doctor and patient
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/doctor-patient-assignments/{id}:
 *   get:
 *     tags:
 *       - Doctor-Patient Assignments
 *     summary: Get Doctor-Patient Assignment by ID
 *     description: >
 *       Returns a single Doctor-Patient assignment by ID.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: getDoctorPatientAssignment
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Doctor-Patient Assignment ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     responses:
 *       '200':
 *         description: Doctor-patient assignment retrieved successfully
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
 *                   example: Doctor-patient assignment retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [assignment]
 *                   properties:
 *                     assignment:
 *                       $ref: '#/components/schemas/DoctorPatientAssignment'
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
 *         description: Doctor-Patient Assignment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Doctor-patient assignment not found
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/doctor-patient-assignments/{id}/status:
 *   patch:
 *     tags:
 *       - Doctor-Patient Assignments
 *     summary: Update Doctor-Patient Assignment Status
 *     description: >
 *       Updates an assignment status to ACTIVE or INACTIVE.
 *       Setting the status to INACTIVE records ended_at.
 *       Setting it to ACTIVE clears ended_at, provided another ACTIVE
 *       assignment does not already exist for the same Doctor-Patient pair.
 *       Reactivation also requires ACTIVE Doctor and Patient accounts, an
 *       available Doctor, assignable Patient intake, and a non-empty
 *       internal assignment_reason.
 *       Requires an ACTIVE ADMIN account.
 *     operationId: updateDoctorPatientAssignmentStatus
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Doctor-Patient Assignment ID.
 *         schema:
 *           type: integer
 *           minimum: 1
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             additionalProperties: false
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: INACTIVE
 *
 *     responses:
 *       '200':
 *         description: Doctor-patient assignment status updated successfully
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
 *                   example: Doctor-patient assignment status updated successfully
 *                 data:
 *                   type: object
 *                   required: [assignment]
 *                   properties:
 *                     assignment:
 *                       $ref: '#/components/schemas/DoctorPatientAssignment'
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
 *         description: Doctor-Patient Assignment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Doctor-patient assignment not found
 *       '409':
 *         description: >
 *           Assignment already has the requested status or another ACTIVE
 *           assignment exists, or reactivation fails account, availability,
 *           intake eligibility, or assignment reason validation.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               statusConflict:
 *                 summary: Assignment already has the requested status
 *                 value:
 *                   success: false
 *                   message: Doctor-patient assignment is already INACTIVE
 *               activeAssignmentExists:
 *                 summary: Another ACTIVE assignment exists
 *                 value:
 *                   success: false
 *                   message: An active assignment already exists for this doctor and patient
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
