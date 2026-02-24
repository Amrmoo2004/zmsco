import { Router } from "express";
import * as closureService from "./projectClosure.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Project Closure
 *   description: Project Closure Process, Checklists, Approvals & Certificates
 *
 * /projects/{projectId}/closure:
 *   post:
 *     summary: Initiate project closure process (creates default 5-step checklist)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checklists:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     item: { type: string }
 *               approvals:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string }
 *     responses:
 *       201: { description: Closure process initiated }
 *   get:
 *     summary: Get closure details for a project
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Closure details with checklist and approval status }
 *
 * /projects/{projectId}/closure/checklist/{itemId}:
 *   put:
 *     summary: Mark a checklist item as completed
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: itemId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Checklist item completed }
 *
 * /projects/{projectId}/closure/approve:
 *   put:
 *     summary: Sign-off closure (role-based, auto-closes project when all approved)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               notes: { type: string }
 *     responses:
 *       200: { description: Closure approval recorded }
 *
 * /projects/{projectId}/closure/certificate:
 *   post:
 *     summary: Generate project completion certificate (requires full closure)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signatories:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     role: { type: string }
 *     responses:
 *       201: { description: Certificate generated with auto-ID (CERT-YYYY-NNN) }
 */

// Initiate / Get closure
router.post("/", auth, permission("UPDATE_PROJECT"), closureService.initiateClosure);
router.get("/", auth, closureService.getClosure);

// Checklist and approvals
router.put("/checklist/:itemId", auth, closureService.updateChecklistItem);
router.put("/approve", auth, closureService.approveClosure);

// Certificate generation
router.post("/certificate", auth, permission("UPDATE_PROJECT"), closureService.generateCertificate);

export default router;
