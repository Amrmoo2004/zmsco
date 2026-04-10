import { Router } from "express";
import * as kpiService from "./kpi.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: ProjectSettings
 *   description: Global Project Configurations (KPIs, Phases, etc)
 *
 * /project-settings/kpis:
 *   get:
 *     summary: Get all active global KPIs
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of KPIs }
 *   post:
 *     summary: Create a newly tracked KPI globally
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn, targetValue]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               unit: { type: string, description: "MongoDB ObjectId" }
 *               targetValue: { type: number }
 *     responses:
 *       201: { description: KPI created }
 *
 * /project-settings/kpis/{id}:
 *   put:
 *     summary: Update an existing KPI
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: KPI updated }
 *   delete:
 *     summary: Delete a KPI globally
 *     tags: [ProjectSettings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: KPI deleted }
 */

router.get("/", auth, kpiService.getAllKpis);
router.post("/", auth, permission("MANAGE_SETTINGS"), kpiService.createKpi);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), kpiService.updateKpi);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), kpiService.deleteKpi);

export default router;
