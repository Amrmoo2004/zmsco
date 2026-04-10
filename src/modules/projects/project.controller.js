import express from "express";
import * as projectService from "./project.services.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project Lifecycle Management
 */

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of projects
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - manager
 *             properties:
 *               name:
 *                 type: string
 *                 example: "مشروع المجمع السكني A"
 *               type:
 *                 type: string
 *                 description: MongoDB ObjectId for project type (blueprint)
 *                 example: "64a2f1c3e21b4a0012345678"
 *               manager:
 *                 type: string
 *                 description: MongoDB ObjectId for the project manager (User)
 *                 example: "64a2f1c3e21b4a0012345679"
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-05-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *               department:
 *                 type: string
 *                 description: MongoDB ObjectId for department
 *               client:
 *                 type: string
 *                 description: MongoDB ObjectId for client
 *               budget:
 *                 type: number
 *                 example: 500000
 *               description:
 *                 type: string
 *               warehouseType:
 *                 type: string
 *                 enum: [SHARED, DEDICATED]
 *                 default: SHARED
 *               dedicatedWarehouse:
 *                 type: string
 *                 description: MongoDB ObjectId for warehouse (required if warehouseType is DEDICATED)
 *               phases:
 *                 type: array
 *                 description: Optional - if omitted, auto-generated from ProjectType blueprint
 *                 items:
 *                   type: object
 *                   properties:
 *                     nameAr: { type: string }
 *                     nameEn: { type: string }
 *                     order: { type: integer }
 *                     expectedDays: { type: integer }
 *                     color: { type: string }
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           description: { type: string }
 *                           isRequired: { type: boolean }
 *               materials:
 *                 type: array
 *                 description: Optional - if omitted, auto-generated from ProjectType blueprint
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string, description: "MongoDB ObjectId for material" }
 *                     quantity: { type: number }
 *               equipments:
 *                 type: array
 *                 description: Optional - if omitted, auto-generated from ProjectType blueprint
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     count: { type: integer }
 *                     unit: { type: string }
 *               members:
 *                 type: array
 *                 description: Optional - if omitted, auto-generated from ProjectType blueprint
 *                 items:
 *                   type: object
 *                   properties:
 *                     jobTitle: { type: string, description: "MongoDB ObjectId for job title" }
 *                     count: { type: integer }
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Project draft created. Use /activate to finalize." }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string, description: "MongoDB ObjectId" }
 *                     name: { type: string }
 *                     budget: { type: number, description: "Allocated Budget (from request)" }
 *                     estimatedCost: { type: number, description: "Auto-calculated estimated cost of resources" }
 *       400:
 *         description: Validation error
 */
router.route("/")
  .get(auth, permission("VIEW_PROJECT"), projectService.get_projects)
  .post(auth, permission("CREATE_PROJECT"), projectService.create_project);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details including members
 *   put:
 *     summary: Update project details
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               type: { type: string, description: "MongoDB ObjectId for project type" }
 *               manager: { type: string, description: "MongoDB ObjectId for manager" }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH] }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               department: { type: string, description: "MongoDB ObjectId for department" }
 *               client: { type: string, description: "MongoDB ObjectId for client" }
 *               budget: { type: number }
 *               description: { type: string }
 *               warehouseType: { type: string, enum: [SHARED, DEDICATED] }
 *               dedicatedWarehouse: { type: string, description: "MongoDB ObjectId for warehouse" }
 *     responses:
 *       200:
 *         description: Project updated
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project deleted
 */
router.route("/:id")
  .get(auth, permission("VIEW_PROJECT"), projectService.get_project)
  .put(auth, permission("EDIT_PROJECT"), projectService.update_project)
  .delete(auth, permission("DELETE_PROJECT"), projectService.delete_project);

/**
 * @swagger
 * /projects/{id}/members/{memberId}/assign:
 *   post:
 *     summary: Assign a user to a project vacancy
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         description: Vacancy ID (ProjectMember ID)
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: MongoDB ObjectId for the user to assign
 *     responses:
 *       200:
 *         description: Member assigned successfully
 */
router.post(
  "/:id/members/:memberId/assign",
  auth,
  permission("EDIT_PROJECT"),
  projectService.assign_member
);

/**
 * @swagger
 * /projects/{id}/summary:
 *   get:
 *     summary: Get full project summary (for review screen)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full project data including phases, members, materials, equipment, documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project: { type: object }
 *                     phases: { type: array }
 *                     members: { type: array }
 *                     materials: { type: array }
 *                     equipment: { type: array }
 *                     documents: { type: array }
 *                     budget: { type: number }
 */
router.get(
  "/:id/summary",
  auth,
  permission("VIEW_PROJECT"),
  projectService.get_project_summary
);

/**
 * @swagger
 * /projects/{id}/activate:
 *   post:
 *     summary: Activate a draft project (Final submit)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project activated and moved from DRAFT to PLANNING
 */
router.post(
  "/:id/activate",
  auth,
  permission("EDIT_PROJECT"),
  projectService.activate_project
);

export default router;
