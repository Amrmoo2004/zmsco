import { Router } from "express";
import * as workflowService from "./workflow.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /workflows:
 *   get:
 *     summary: Get all workflows
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of workflows }
 *   post:
 *     summary: Create a workflow
 *     tags: [Settings]
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
 *                 enum: [مشتريات, مخزون, موارد بشرية, مشروع]
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     stepOrder: { type: integer }
 *                     role: { type: string, description: "MongoDB ObjectId" }
 *                     user: { type: string, description: "MongoDB ObjectId" }
 *                     isMandatory: { type: boolean }
 *     responses:
 *       201: { description: Workflow created }
 *
 * /workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow details }
 *   put:
 *     summary: Update workflow
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow updated }
 *   delete:
 *     summary: Delete workflow
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow deleted }
 */

router.get("/", auth, workflowService.getAllWorkflows);
router.post("/", auth, permission("MANAGE_SETTINGS"), workflowService.createWorkflow);
router.get("/:id", auth, workflowService.getWorkflowById);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), workflowService.updateWorkflow);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), workflowService.deleteWorkflow);

export default router;
