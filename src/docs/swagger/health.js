/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Check API and database availability
 *     description: Public. Runs a trivial database query so a hosting platform can tell when the API has lost its database. Returns no configuration or version details.
 *     operationId: getHealth
 *     responses:
 *       '200':
 *         description: The API and its database are reachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   required: [status, database]
 *                   properties:
 *                     status: { type: string, enum: [ok] }
 *                     database: { type: string, enum: [up] }
 *       '503':
 *         description: The database cannot be reached
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message]
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Database unavailable }
 */
