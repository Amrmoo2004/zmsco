import { Router } from "express";
import * as projectTypeService from "./projectType.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Types
 *   description: Project Blueprint Template Management
 *
 * /project-types:
 *   get:
 *     summary: Get all project types (blueprints)
 *     tags: [Project Types]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of project types }
 *   post:
 *     summary: Create a new project type
 *     tags: [Project Types]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               phases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     order: { type: integer }
 *                     expectedDays: { type: integer }
 *                     isRequired: { type: boolean }
 *     responses:
 *       201: { description: Project type created }
 *
 * /project-types/{id}:
 *   get:
 *     summary: Get project type by ID
 *     tags: [Project Types]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Project type details }
 *   put:
 *     summary: Update project type
 *     tags: [Project Types]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Project type updated }
 *   delete:
 *     summary: Delete project type
 *     tags: [Project Types]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Project type deleted }
 */

router.get("/", auth, projectTypeService.getAllProjectTypes);
router.post("/", auth, permission("CREATE_PROJECT"), projectTypeService.createProjectType);
router.get("/:id", auth, projectTypeService.getProjectTypeById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), projectTypeService.updateProjectType);
router.delete("/:id", auth, permission("DELETE_PROJECT"), projectTypeService.deleteProjectType);

export default router;
