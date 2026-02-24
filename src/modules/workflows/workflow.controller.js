import { Router } from "express";
import * as workflowService from "./workflow.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Workflows
 *   description: Dynamic Approval Workflow Engine
 *
 * /workflows:
 *   get:
 *     summary: Get all workflows
 *     tags: [Workflows]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of workflows }
 *   post:
 *     summary: Create a workflow
 *     tags: [Workflows]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, entityType, steps]
 *             properties:
 *               name: { type: string }
 *               entityType:
 *                 type: string
 *                 enum: [MaterialRequest, PurchaseOrder, ProjectClosure, PhaseApproval, MaintenanceRequest, LeaveRequest]
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     stepOrder: { type: integer }
 *                     role: { type: string }
 *                     user: { type: string }
 *                     isMandatory: { type: boolean }
 *     responses:
 *       201: { description: Workflow created }
 *
 * /workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     tags: [Workflows]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow details }
 *   put:
 *     summary: Update workflow
 *     tags: [Workflows]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow updated }
 *   delete:
 *     summary: Delete workflow
 *     tags: [Workflows]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow deleted }
 */

router.get("/", auth, workflowService.getAllWorkflows);
router.post("/", auth, permission("CREATE_PROJECT"), workflowService.createWorkflow);
router.get("/:id", auth, workflowService.getWorkflowById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), workflowService.updateWorkflow);
router.delete("/:id", auth, permission("DELETE_PROJECT"), workflowService.deleteWorkflow);

export default router;
