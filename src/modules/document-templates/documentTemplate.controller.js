import { Router } from "express";
import * as documentTemplateService from "./documentTemplate.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /document-templates:
 *   get:
 *     summary: Get all document templates
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of document templates }
 *   post:
 *     summary: Create a new document template
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, category]
 *             properties:
 *               name: { type: string }
 *               type: { type: string, description: "e.g. عقد, أمر شراء" }
 *               category: { type: string, description: "e.g. عربي, عربي/إنجليزي" }
 *               version: { type: string, default: "v1.0" }
 *               content: { type: string, description: "HTML or rich text content" }
 *     responses:
 *       201: { description: Document template created }
 * 
 * /document-templates/{id}:
 *   get:
 *     summary: Get a document template by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Template details }
 *   put:
 *     summary: Update a document template
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
 *               type: { type: string }
 *               category: { type: string }
 *               version: { type: string }
 *               content: { type: string }
 *     responses:
 *       200: { description: Template updated }
 *   delete:
 *     summary: Delete a document template
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Template deleted }
 */

router.get("/", auth, documentTemplateService.getAllTemplates);
router.post("/", auth, permission("MANAGE_SETTINGS"), documentTemplateService.createTemplate);
router.get("/:id", auth, documentTemplateService.getTemplateById);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), documentTemplateService.updateTemplate);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), documentTemplateService.deleteTemplate);

export default router;
