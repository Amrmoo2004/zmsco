import { Router } from "express";
import * as projectTemplateService from "./project-template.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Templates
 *   description: Project Template Management
 */

/**
 * @swagger
 * /project-templates:
 *   get:
 *     summary: Get all project templates
 *     tags: [Project Templates]
 *     responses:
 *       200: { description: List of templates }
 *   post:
 *     summary: Create project template
 *     tags: [Project Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               phases: { type: array }
 *               defaultMembers: { type: array }
 *     responses:
 *       201: { description: Template created }
 */
router.get("/", auth, permission("VIEW_REPORTS"), projectTemplateService.getAllTemplates);
router.post("/", auth, permission("CREATE_PROJECT"), projectTemplateService.createTemplate);

/**
 * @swagger
 * /project-templates/{id}:
 *   get:
 *     summary: Get template by ID
 *     tags: [Project Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Template details }
 *   put:
 *     summary: Update template
 *     tags: [Project Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Template updated }
 *   delete:
 *     summary: Delete template
 *     tags: [Project Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Template deleted }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), projectTemplateService.getTemplateById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), projectTemplateService.updateTemplate);
router.delete("/:id", auth, permission("DELETE_PROJECT"), projectTemplateService.deleteTemplate);

/**
 * @swagger
 * /project-templates/{id}/apply:
 *   post:
 *     summary: Apply template to create new project
 *     tags: [Project Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectName
 *             properties:
 *               projectName: { type: string }
 *               startDate: { type: string, format: date }
 *     responses:
 *       201: { description: Project created from template }
 */
router.post("/:id/apply", auth, permission("CREATE_PROJECT"), projectTemplateService.applyTemplate);

export default router;
