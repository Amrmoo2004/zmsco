import { Router } from "express";
import * as approvalRuleService from "./approvalRule.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /approval-rules:
 *   get:
 *     summary: Get all approval rules (Matrix)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of approval rules mapping conditions to workflows }
 *   post:
 *     summary: Create an approval rule
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType, description, workflow]
 *             properties:
 *               entityType:
 *                 type: string
 *                 enum: [مشتريات, مخزون, موارد بشرية, مشروع]
 *               description: { type: string, description: "e.g., Less than 50K SAR" }
 *               condition:
 *                 type: object
 *                 properties:
 *                   isAlways: { type: boolean, default: false }
 *                   minAmount: { type: number }
 *                   maxAmount: { type: number }
 *               workflow: { type: string, description: "Workflow Template ObjectId" }
 *     responses:
 *       201: { description: Approval rule created }
 *
 * /approval-rules/{id}:
 *   get:
 *     summary: Get approval rule by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Approval rule details }
 *   put:
 *     summary: Update an approval rule
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entityType: { type: string }
 *               description: { type: string }
 *               condition:
 *                 type: object
 *                 properties:
 *                   isAlways: { type: boolean }
 *                   minAmount: { type: number }
 *                   maxAmount: { type: number }
 *               workflow: { type: string }
 *     responses:
 *       200: { description: Approval rule updated }
 *   delete:
 *     summary: Delete approval rule
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Approval rule deleted }
 */

router.get("/", auth, approvalRuleService.getAllRules);
router.post("/", auth, permission("MANAGE_SETTINGS"), approvalRuleService.createRule);
router.get("/:id", auth, approvalRuleService.getRuleById);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), approvalRuleService.updateRule);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), approvalRuleService.deleteRule);

export default router;
