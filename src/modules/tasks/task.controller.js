import { Router } from "express";
import * as taskService from "./task.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true }); // mergeParams to access :projectId and :phaseId

/**
 * @swagger
 * tags:
 *   name: Phase Tasks
 *   description: Task Management within Project Phases
 *
 * /projects/{projectId}/phases/{phaseId}/tasks:
 *   get:
 *     summary: Get all tasks for a phase
 *     tags: [Phase Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of tasks }
 *   post:
 *     summary: Create a task in a phase
 *     tags: [Phase Tasks]
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               assignedTo: { type: string }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH] }
 *               dueDate: { type: string, format: date }
 *     responses:
 *       201: { description: Task created }
 *
 * /projects/{projectId}/phases/{phaseId}/tasks/{taskId}:
 *   put:
 *     summary: Update a task
 *     tags: [Phase Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *       - { in: path, name: taskId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Task updated }
 *   delete:
 *     summary: Delete a task
 *     tags: [Phase Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *       - { in: path, name: taskId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Task deleted }
 *
 * /projects/{projectId}/phases/{phaseId}/tasks/submit-attachment:
 *   post:
 *     summary: Submit a required phase attachment
 *     tags: [Phase Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType: { type: string }
 *               attachmentId: { type: string }
 *     responses:
 *       200: { description: Attachment submitted for review }
 *
 * /projects/{projectId}/phases/{phaseId}/tasks/sign-off:
 *   put:
 *     summary: Sign-off on a phase (role-based approval)
 *     tags: [Phase Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: phaseId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               notes: { type: string }
 *     responses:
 *       200: { description: Phase sign-off recorded }
 */

// Task CRUD
router.get("/", auth, taskService.getTasksByPhase);
router.post("/", auth, permission("UPDATE_PROJECT"), taskService.createTask);
router.put("/:taskId", auth, permission("UPDATE_PROJECT"), taskService.updateTask);
router.delete("/:taskId", auth, permission("DELETE_PROJECT"), taskService.deleteTask);

// Phase Gating Actions
router.post("/submit-attachment", auth, taskService.submitPhaseAttachment);
router.put("/review-attachment/:attachmentSlotId", auth, permission("UPDATE_PROJECT"), taskService.reviewPhaseAttachment);
router.put("/sign-off", auth, taskService.signOffPhase);

export default router;
