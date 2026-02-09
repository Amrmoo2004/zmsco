import { Router } from "express";
import * as projectMemberService from "./project-member.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Members
 *   description: Project Team Management
 */

/**
 * @swagger
 * /projects/{projectId}/members:
 *   get:
 *     summary: Get project members
 *     tags: [Project Members]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of members }
 *   post:
 *     summary: Add member to project
 *     tags: [Project Members]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - role
 *             properties:
 *               user: { type: string }
 *               role: { type: string }
 *     responses:
 *       201: { description: Member added }
 */
router.get("/:projectId/members", auth, permission("VIEW_REPORTS"), projectMemberService.getProjectMembers);
router.post("/:projectId/members", auth, permission("UPDATE_PROJECT"), projectMemberService.addProjectMember);

/**
 * @swagger
 * /projects/{projectId}/members/{id}:
 *   put:
 *     summary: Update member role
 *     tags: [Project Members]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
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
 *             properties:
 *               role: { type: string }
 *     responses:
 *       200: { description: Member updated }
 *   delete:
 *     summary: Remove member from project
 *     tags: [Project Members]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Member removed }
 */
router.put("/:projectId/members/:id", auth, permission("UPDATE_PROJECT"), projectMemberService.updateProjectMember);
router.delete("/:projectId/members/:id", auth, permission("UPDATE_PROJECT"), projectMemberService.removeProjectMember);

export default router;
