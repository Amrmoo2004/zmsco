import { Router } from "express";
import * as phaseService from "./phase.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: ProjectSettings
 *   description: Global Project Configurations (KPIs, Phases, etc)
 *
 * /project-settings/phases:
 *   get:
 *     summary: Get all global project phases catalog
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of Phases }
 *   post:
 *     summary: Create a new global phase template
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               color: { type: string }
 *               order: { type: integer }
 *     responses:
 *       201: { description: Phase template created }
 *
 * /project-settings/phases/{id}:
 *   put:
 *     summary: Update an existing phase template
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Phase updated }
 *   delete:
 *     summary: Softly delete a global phase
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Phase deleted }
 */

router.get("/", auth, phaseService.getAllPhases);
router.post("/", auth, permission("MANAGE_SETTINGS"), phaseService.createPhase);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), phaseService.updatePhase);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), phaseService.deletePhase);

export default router;
