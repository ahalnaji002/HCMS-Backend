/**
 * @openapi
 * /api/admin/dashboard:
 *   get:
 *     tags:
 *       - Admin Dashboard & Reports
 *     summary: Get Admin dashboard
 *     description: Returns administrative dashboard metrics. Requires an ACTIVE ADMIN account.
 *     operationId: getAdminDashboard
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       '200':
 *         description: Admin dashboard retrieved successfully
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
 *                   example: Admin dashboard retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/AdminDashboard'
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
 * /api/admin/reports/patients:
 *   get:
 *     tags:
 *       - Admin Dashboard & Reports
 *     summary: Get Patient report
 *     description: Returns a paginated Patient report. Requires an ACTIVE ADMIN account.
 *     operationId: getAdminPatientReport
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of records per page.
 *
 *     responses:
 *       '200':
 *         description: Patient report retrieved successfully
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
 *                   example: Patient report retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [items, page, limit, total, total_pages]
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PatientReportItem'
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     total_pages:
 *                       type: integer
 *                       example: 2
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/reports/treatment-plans:
 *   get:
 *     tags:
 *       - Admin Dashboard & Reports
 *     summary: Get Treatment Plan report
 *     description: Returns a paginated Treatment Plan report. Requires an ACTIVE ADMIN account.
 *     operationId: getAdminTreatmentPlanReport
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *
 *     responses:
 *       '200':
 *         description: Treatment Plan report retrieved successfully
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
 *                   example: Treatment Plan report retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [items, page, limit, total, total_pages]
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TreatmentPlanReportItem'
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 10
 *                     total_pages:
 *                       type: integer
 *                       example: 1
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /api/admin/reports/assistance-requests:
 *   get:
 *     tags:
 *       - Admin Dashboard & Reports
 *     summary: Get Assistance Request report
 *     description: Returns a paginated Assistance Request report. Requires an ACTIVE ADMIN account.
 *     operationId: getAdminAssistanceRequestReport
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - PENDING
 *             - UNDER_REVIEW
 *             - APPROVED
 *             - REJECTED
 *             - COMPLETED
 *         description: Optional Assistance Request status filter.
 *
 *     responses:
 *       '200':
 *         description: Assistance Request report retrieved successfully
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
 *                   example: Assistance Request report retrieved successfully
 *                 data:
 *                   type: object
 *                   required: [items, page, limit, total, total_pages]
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AssistanceRequestReportItem'
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 15
 *                     total_pages:
 *                       type: integer
 *                       example: 1
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
