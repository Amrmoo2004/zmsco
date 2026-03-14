import express from "express";
import * as projectService from "./project.services.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management endpoints
 */

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of projects
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
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
 *               type:
 *                 type: string
 *               manager:
 *                 type: string
 *                 description: User ID of the project manager
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               department:
 *                 type: string
 *               client:
 *                 type: string
 *               budget:
 *                 type: number
 *               description:
 *                 type: string
 *               warehouseType:
 *                 type: string
 *                 enum: [SHARED, DEDICATED]
 *                 default: SHARED
 *               phases:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     order: { type: integer }
 *                     expectedDays: { type: integer }
 *                     customFields: { type: object }
 *                     requiredAttachments:
 *                       type: array
 *                       items: { type: object }
 *                     requiredApprovals:
 *                       type: array
 *                       items: { type: object }
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *               equipments:
 *                 type: array
 *                 items:
 *                   type: object
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Project created successfully
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
 *     responses:
 *       200:
 *         description: Project updated
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
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
 *                 description: ID of the user to assign
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full project data including phases, members, materials, equipment, documents
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
