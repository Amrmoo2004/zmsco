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
 *       - in: query
 *         name: phase
 *         schema: { type: string }
 *         description: "Filter by Phase ObjectId"
 *     responses:
 *       200: { description: List of members }
 *   post:
 *     summary: Add member to project (or create a VACANT slot)
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
 *             properties:
 *               user: { type: string, description: "User ObjectId (optional - omit to create a VACANT slot)" }
 *               role: { type: string, description: "Role title e.g. مدير المشروع" }
 *               jobTitle: { type: string, description: "JobTitle ObjectId" }
 *               phase: { type: string, description: "Phase ObjectId (optional)" }
 *               startDate: { type: string, format: date, description: "Assignment start date" }
 *               endDate: { type: string, format: date, description: "Assignment end date" }
 *               allocationPercentage: { type: number, description: "Resource allocation percentage (e.g. 80)" }
 *               notes: { type: string, description: "Optional notes about this assignment" }
 *               status: { type: string, enum: [ACTIVE, VACANT], description: "Defaults to ACTIVE if user provided, VACANT otherwise" }
 *               estimatedCost: { type: number, description: "Estimated cost for this role slot" }
 *     responses:
 *       201: { description: Member added or vacancy created }
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
 *               role: { type: string, description: "MongoDB ObjectId" }
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
