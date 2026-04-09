import { Router } from "express";
import * as scheduledReportService from "./scheduledReport.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /scheduled-reports:
 *   get:
 *     summary: Get all scheduled reports
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of scheduled reports }
 *   post:
 *     summary: Create a new scheduled report
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, periodicity]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               periodicity: { type: string, enum: ["يومي", "أسبوعي", "شهري"] }
 *               format: { type: string, enum: ["PDF", "Excel"] }
 *               recipients: { type: array, items: { type: string, description: "User ObjectIds" } }
 *               isActive: { type: boolean, default: true }
 *               reportTemplate: { type: string, description: "Report Template ObjectId" }
 *     responses:
 *       201: { description: Scheduled report created }
 * 
 * /scheduled-reports/{id}:
 *   get:
 *     summary: Get a scheduled report by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Scheduled report details }
 *   put:
 *     summary: Update a scheduled report
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               periodicity: { type: string }
 *               format: { type: string }
 *               recipients: { type: array, items: { type: string } }
 *               isActive: { type: boolean }
 *               reportTemplate: { type: string }
 *     responses:
 *       200: { description: Scheduled report updated }
 *   delete:
 *     summary: Delete a scheduled report
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Scheduled report deleted }
 * 
 * /scheduled-reports/{id}/toggle:
 *   patch:
 *     summary: Toggle scheduled report active status (نشط / متوقف)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status toggled }
 */

router.get("/", auth, scheduledReportService.getAllScheduledReports);
router.post("/", auth, permission("MANAGE_SETTINGS"), scheduledReportService.createScheduledReport);
router.get("/:id", auth, scheduledReportService.getScheduledReportById);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), scheduledReportService.updateScheduledReport);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), scheduledReportService.deleteScheduledReport);
router.patch("/:id/toggle", auth, permission("MANAGE_SETTINGS"), scheduledReportService.toggleScheduledReportStatus);

export default router;
