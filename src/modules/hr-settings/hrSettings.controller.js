import { Router } from "express";
import * as hrSettingsService from "./hrSettings.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /hr-settings:
 *   get:
 *     summary: Get HR configuration
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current HR configuration }
 *   put:
 *     summary: Update HR configuration
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attendanceTracking: { type: boolean }
 *               dailyWorkingHours: { type: number }
 *               weeklyWorkingDays: { type: number }
 *               overtimeRate: { type: number }
 *               leaveManagement: { type: boolean }
 *               annualLeaveDays: { type: number }
 *               sickLeaveDays: { type: number }
 *               directManagerApproval: { type: boolean }
 *               performanceEvaluation: { type: boolean }
 *               evaluationPeriodicity: { type: string }
 *               sharedResourcePool: { type: boolean }
 *     responses:
 *       200: { description: Configuration updated }
 */

router.get("/", auth, hrSettingsService.getHrSettings);
router.put("/", auth, permission("MANAGE_SETTINGS"), hrSettingsService.updateHrSettings);

export default router;
