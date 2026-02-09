import { Router } from "express";
import * as projectPhaseService from "./project-phase.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Phases
 *   description: Project Phase Management
 */

/**
 * @swagger
 * /projects/{projectId}/phases:
 *   get:
 *     summary: Get project phases
 *     tags: [Project Phases]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of phases }
 *   post:
 *     summary: Create project phase
 *     tags: [Project Phases]
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
 *               - name
 *               - startDate
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               status: { type: string }
 *     responses:
 *       201: { description: Phase created }
 */
router.get("/:projectId/phases", auth, permission("VIEW_REPORTS"), projectPhaseService.getProjectPhases);
router.post("/:projectId/phases", auth, permission("UPDATE_PROJECT"), projectPhaseService.createProjectPhase);

/**
 * @swagger
 * /projects/{projectId}/phases/{id}:
 *   put:
 *     summary: Update project phase
 *     tags: [Project Phases]
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
 *       200: { description: Phase updated }
 *   delete:
 *     summary: Delete project phase
 *     tags: [Project Phases]
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
 *       200: { description: Phase deleted }
 */
router.put("/:projectId/phases/:id", auth, permission("UPDATE_PROJECT"), projectPhaseService.updateProjectPhase);
router.delete("/:projectId/phases/:id", auth, permission("UPDATE_PROJECT"), projectPhaseService.deleteProjectPhase);

export default router;
