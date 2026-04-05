import { Router } from "express";
import * as phaseApprovalService from "./phaseApproval.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Phase Approvals
 *   description: Phase-level approval workflow management
 *
 * /projects/{projectId}/phases/{phaseId}/approvals:
 *   get:
 *     summary: Get all approvals for a phase
 *     tags: [Phase Approvals]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of phase approvals sorted by date }
 *   post:
 *     summary: Create a new approval request for a phase
 *     tags: [Phase Approvals]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approvalType, referenceModel, referenceId]
 *             properties:
 *               approvalType:
 *                 type: string
 *                 enum: [ATTACHMENT, PERMIT, SIGN_OFF]
 *                 description: Type of thing being approved
 *               referenceModel:
 *                 type: string
 *                 description: Mongoose model name the approval refers to (e.g. "Attachment")
 *               referenceId:
 *                 type: string
 *                 description: ObjectId of the referenced document
 *     responses:
 *       201: { description: Phase approval record created }
 *
 * /projects/{projectId}/phases/{phaseId}/approvals/{approvalId}:
 *   put:
 *     summary: Process (approve/reject) a phase approval
 *     tags: [Phase Approvals]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *       - { in: path, name: approvalId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               notes:
 *                 type: string
 *                 description: Optional review notes
 *     responses:
 *       200: { description: Approval processed and recorded with reviewer details }
 *       404: { description: Approval not found }
 */

router.get("/", auth, phaseApprovalService.getPhaseApprovals);
router.post("/", auth, permission("UPDATE_PROJECT"), phaseApprovalService.createPhaseApproval);
router.put("/:approvalId", auth, permission("UPDATE_PROJECT"), phaseApprovalService.processPhaseApproval);

export default router;
