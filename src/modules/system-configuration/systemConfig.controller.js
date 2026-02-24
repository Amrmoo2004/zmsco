import { Router } from "express";
import * as systemConfigService from "./systemConfig.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: System Configuration
 *   description: System-wide Settings (Singleton document)
 *
 * /system-config:
 *   get:
 *     summary: Get system configuration
 *     tags: [System Configuration]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current system configuration }
 *   put:
 *     summary: Update system configuration
 *     tags: [System Configuration]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName: { type: string }
 *               registrationNumber: { type: string }
 *               taxId: { type: string }
 *               logoUrl: { type: string }
 *               timezone: { type: string }
 *               dateFormat: { type: string }
 *               currency: { type: string }
 *     responses:
 *       200: { description: Configuration updated }
 */

router.get("/", auth, systemConfigService.getConfig);
router.put("/", auth, permission("CREATE_PROJECT"), systemConfigService.updateConfig);

export default router;
