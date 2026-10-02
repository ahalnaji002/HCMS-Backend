/**
 * @openapi
 * /api/patient/medical-record:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: Get own Medical Record
 *     description: Returns the Medical Record for the authenticated Patient.
 *     operationId: getOwnMedicalRecord
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Medical Record retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Medical Record retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     medical_record:
 *                       $ref: '#/components/schemas/MedicalRecord'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or Medical Record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/treatment-plans:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: List own Treatment Plans
 *     description: Returns Treatment Plans belonging to the authenticated Patient in ascending ID order. Patient access is read-only.
 *     operationId: listOwnTreatmentPlans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Treatment Plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Treatment Plans retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatment_plans:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TreatmentPlan'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/treatment-plans/{planId}:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: Get own Treatment Plan
 *     description: Returns the Treatment Plan only when it belongs to the authenticated Patient.
 *     operationId: getOwnTreatmentPlan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Treatment Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Treatment Plan retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     treatment_plan:
 *                       $ref: '#/components/schemas/TreatmentPlan'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or own Treatment Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/treatment-plans/{planId}/medications:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: List medications for own Treatment Plan
 *     description: Returns medications belonging to the Patient's Treatment Plan. Patient access is read-only.
 *     operationId: listOwnTreatmentMedications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Treatment Medications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Treatment Medications retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     medications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TreatmentMedication'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or own Treatment Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/treatment-plans/{planId}/medications/{medicationId}:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: Get medication for own Treatment Plan
 *     description: Returns a medication only when it belongs to the Patient's Treatment Plan.
 *     operationId: getOwnTreatmentMedication
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: path
 *         name: medicationId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Treatment Medication retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Treatment Medication retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     medication:
 *                       $ref: '#/components/schemas/TreatmentMedication'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile, own Treatment Plan, or medication not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/treatment-plans/{planId}/appointments:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: List appointments for own Treatment Plan
 *     description: Returns appointments belonging to the Patient's Treatment Plan. Patient access is read-only.
 *     operationId: listOwnTreatmentAppointments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Treatment Appointments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Treatment Appointments retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TreatmentAppointment'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile or own Treatment Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 * /api/patient/treatment-plans/{planId}/appointments/{appointmentId}:
 *   get:
 *     tags: [Patient Medical Records]
 *     summary: Get appointment for own Treatment Plan
 *     description: Returns an appointment only when it belongs to the Patient's Treatment Plan.
 *     operationId: getOwnTreatmentAppointment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: Treatment Appointment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Treatment Appointment retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointment:
 *                       $ref: '#/components/schemas/TreatmentAppointment'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/AuthenticationRequired'
 *       '403':
 *         description: Account is inactive or role is not PATIENT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Patient profile, own Treatment Plan, or appointment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
