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
 *                   required: [order]
 *                   properties:
 *                     nameAr: { type: string, example: "التخطيط" }
 *                     nameEn: { type: string, example: "Planning" }
 *                     color: { type: string, example: "#3498db" }
 *                     order: { type: integer, example: 1 }
 *                     expectedDays: { type: integer, example: 10 }
 *                     isRequired: { type: boolean, default: true }
 *                     fields:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         required: [name]
 *                         properties:
 *                           name: { type: string, example: "نطاق المشروع" }
 *                           type: { type: string, enum: ['text', 'textarea', 'number', 'date', 'file'], default: text }
 *                           isRequired: { type: boolean }
 *                     attachments:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         required: [name]
 *                         properties:
 *                           name: { type: string, example: "رخصة البناء" }
 *                           type: { type: string, enum: ['PDF', 'IMAGE', 'ANY'], default: ANY }
 *                           isRequired: { type: boolean }
 *                     permits:
 *                       type: array
 *                       example: []
 *                       description: Required permits/licenses for this phase (e.g. Building Permit)
 *                       items:
 *                         type: object
 *                         required: [name]
 *                         properties:
 *                           name: { type: string, example: "رخصة البناء البلدية" }
 *                           isRequired: { type: boolean }
 *                     approvals:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         required: [entity]
 *                         properties:
 *                           entity: { type: string, description: "Role ObjectId - Get from GET /api/roles" }
 *                           isRequired: { type: boolean }
 *                     tasks:
 *                       type: array
 *                       example: []
 *                       items:
 *                         type: object
 *                         required: [name]
 *                         properties:
 *                           name: { type: string, example: "إعداد المخططات" }
 *                           description: { type: string }
 *                           isRequired: { type: boolean }
 *               defaultResources:
 *                 type: object
 *                 description: Default resources pre-filled when creating a project of this type
 *                 properties:
 *                   employees:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         jobTitle: { type: string, description: "JobTitle ObjectId - Get from GET /api/job-titles" }
 *                         count: { type: number, example: 2 }
 *                   materials:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         material: { type: string, description: "Material ObjectId - Get from GET /api/materials" }
 *                         quantity: { type: number, example: 100 }
 *                   equipments:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name: { type: string, example: "رافعة" }
 *                         count: { type: number, example: 1 }
 *                         unit: { type: string, example: "وحدة" }
 *                         estimatedDailyCost: { type: number, example: 500 }
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
