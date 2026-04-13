import { Router } from "express";
import * as workflowService from "./workflow.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /workflows:
 *   get:
 *     summary: Get all workflow templates (قوالب سير العمل)
 *     description: >
 *       Returns all approval workflow templates.
 *       Each Workflow defines an ordered list of approval steps.
 *       Each step is assigned to a Role (e.g. Project Manager → CFO → CEO).
 *       The Workflow is then linked to an ApprovalRule that controls when to trigger it.
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of workflow templates }
 *   post:
 *     summary: Create a new workflow template
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
 *               name:
 *                 type: string
 *                 example: "موافقة طلب شراء كبير"
 *               entityType:
 *                 type: string
 *                 enum: [مشتريات, مخزون, موارد بشرية, مشروع]
 *                 example: مشتريات
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               steps:
 *                 type: array
 *                 description: Ordered list of approval steps (step 1 first, then 2, etc.)
 *                 items:
 *                   type: object
 *                   required: [stepOrder, role]
 *                   properties:
 *                     stepOrder:
 *                       type: integer
 *                       example: 1
 *                     stepName:
 *                       type: string
 *                       example: "موافقة مدير المشروع"
 *                       description: Short label shown on the workflow diagram card
 *                     actionLabel:
 *                       type: string
 *                       example: "مراجعة والموافقة"
 *                       description: Subtitle description shown under the step name
 *                     role:
 *                       type: string
 *                       description: "Role ObjectId - GET /api/roles to find valid IDs"
 *                     user:
 *                       type: string
 *                       description: "Optional - assign to a specific User instead of a Role"
 *                     isMandatory:
 *                       type: boolean
 *                       default: true
 *     responses:
 *       201: { description: Workflow template created successfully }
 *
 * /workflows/{id}:
 *   get:
 *     summary: Get a single workflow by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Workflow details with populated role/user names }
 *   put:
 *     summary: Update workflow (name, steps, isActive)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               entityType: { type: string, enum: [مشتريات, مخزون, موارد بشرية, مشروع] }
 *               isActive: { type: boolean }
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     stepOrder: { type: integer }
 *                     stepName: { type: string }
 *                     actionLabel: { type: string }
 *                     role: { type: string }
 *                     isMandatory: { type: boolean }
 *     responses:
 *       200: { description: Workflow updated successfully }
 *   delete:
 *     summary: Delete a workflow
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
