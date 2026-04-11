import { Router } from "express";
import * as projectTypeService from "./projectType.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: System Settings - Departments, Job Titles, Workflows, Project Types, Roles & Configurations
 *
 * /project-types:
 *   get:
 *     summary: Get all project types (blueprints)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of project types }
 *   post:
 *     summary: Create a new project type
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn, code]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               code: { type: string }
 *               description: { type: string }
 *               category: { type: string, description: "MongoDB ObjectId" }
 *               phases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nameAr: { type: string }
 *                     nameEn: { type: string }
 *                     color: { type: string }
 *                     order: { type: integer }
 *                     expectedDays: { type: integer }
 *                     isRequired: { type: boolean }
 *                     fields:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           type: { type: string, enum: ['text', 'textarea', 'number', 'date', 'file'] }
 *                           isRequired: { type: boolean }
 *                     attachments:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           type: { type: string, enum: ['PDF', 'IMAGE', 'ANY'] }
 *                           isRequired: { type: boolean }
 *                     approvals:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         properties:
 *                           entity: { type: string, description: "Role ObjectId" }
 *                           isRequired: { type: boolean }
 *                     tasks:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           description: { type: string }
 *                           isRequired: { type: boolean }
 *               defaultResources:
 *                 type: object
 *                 properties:
 *                   employees:
 *                     type: array
 *                     items: { properties: { jobTitle: { type: string }, count: { type: number } } }
 *                   materials:
 *                     type: array
 *                     items: { properties: { material: { type: string, description: "MongoDB ObjectId" }, quantity: { type: number } } }
 *                   equipments:
 *                     type: array
 *                     items: { properties: { name: { type: string }, count: { type: number }, estimatedDailyCost: { type: number } } }
 *     responses:
 *       201: { description: Project type created }
 *
 * /project-types/{id}:
 *   get:
 *     summary: Get project type by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Project type details }
 *   put:
 *     summary: Update project type
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Project type updated }
 *   delete:
 *     summary: Delete project type
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Project type deleted }
 *
 * /project-types/{id}/instantiate-phases:
 *   get:
 *     summary: Get phases formatted for project creation
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: List of mapped phases ready for Project instantiation }
 */

router.get("/", auth, projectTypeService.getAllProjectTypes);
router.post("/", auth, permission("MANAGE_SETTINGS"), projectTypeService.createProjectType);
router.get("/:id", auth, projectTypeService.getProjectTypeById);
router.get("/:id/instantiate-phases", auth, projectTypeService.instantiatePhases);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), projectTypeService.updateProjectType);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), projectTypeService.deleteProjectType);

export default router;
