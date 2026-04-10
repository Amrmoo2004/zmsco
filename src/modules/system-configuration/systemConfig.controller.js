import { Router } from "express";
import * as systemConfigService from "./systemConfig.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /system-config:
 *   get:
 *     summary: Get system configuration
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current system configuration }
 *   put:
 *     summary: Update system configuration
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyNameAr: { type: string }
 *               companyNameEn: { type: string }
 *               registrationNumber: { type: string }
 *               taxId: { type: string }
 *               logoUrl: { type: string }
 *               address: { type: string }
 *               phoneNumber: { type: string }
 *               email: { type: string }
 *               website: { type: string }
 *               defaultLanguage: { type: string }
 *               financialYearStart: { type: string }
 *               maintenanceMode: { type: boolean }
 *               autoBackup: { type: boolean }
 *               timezone: { type: string }
 *               dateFormat: { type: string }
 *               currency: { type: string }

 *     responses:
 *       200: { description: Configuration updated }
 */

router.get("/", auth, systemConfigService.getConfig);
router.put("/", auth, permission("MANAGE_SETTINGS"), systemConfigService.updateConfig);

export default router;
