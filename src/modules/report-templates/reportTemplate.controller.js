import { Router } from "express";
import * as reportTemplateService from "./reportTemplate.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /report-templates:
 *   get:
 *     summary: Get all report templates (own + public)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PROJECTS, HR, INVENTORY, PROCUREMENT, FINANCIAL, EQUIPMENT, TICKETS]
 *         description: Filter templates by report type
 *     responses:
 *       200: { description: List of saved report templates }
 *   post:
 *     summary: Create a new report template
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string }
 *               type:
 *                 type: string
 *                 enum: [PROJECTS, HR, INVENTORY, PROCUREMENT, FINANCIAL, EQUIPMENT, TICKETS]
 *               description: { type: string }
 *               filters:
 *                 type: object
 *                 properties:
 *                   dateFrom: { type: string, format: date }
 *                   dateTo: { type: string, format: date }
 *                   status: { type: array, items: { type: string } }
 *                   project: { type: string }
 *                   department: { type: string }
 *               columns:
 *                 type: array
 *                 items: { type: string }
 *                 description: List of fields to include in the report
 *               sortBy:
 *                 type: object
 *                 properties:
 *                   field: { type: string }
 *                   order: { type: string, enum: [asc, desc] }
 *               isPublic: { type: boolean, default: false }
 *     responses:
 *       201: { description: Report template created }
 *
 * /report-templates/{id}:
 *   get:
 *     summary: Get a report template by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Template details }
 *       404: { description: Template not found }
 *   put:
 *     summary: Update a report template (owner only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               filters: { type: object }
 *               columns: { type: array, items: { type: string } }
 *               isPublic: { type: boolean }
 *     responses:
 *       200: { description: Template updated }
 *   delete:
 *     summary: Delete a report template (owner only)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Template deleted }
 *
 * /report-templates/{id}/run:
 *   post:
 *     summary: Execute a saved report template and return the data
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Report results with count and data array
 *       404: { description: Template not found }
 */

router.get("/", auth, reportTemplateService.getAllTemplates);
router.post("/", auth, permission("VIEW_REPORTS"), reportTemplateService.createTemplate);
router.get("/:id", auth, reportTemplateService.getTemplateById);
router.put("/:id", auth, reportTemplateService.updateTemplate);
router.delete("/:id", auth, reportTemplateService.deleteTemplate);
router.post("/:id/run", auth, permission("VIEW_REPORTS"), reportTemplateService.runTemplate);

export default router;
