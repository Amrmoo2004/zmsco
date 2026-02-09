import express from "express";
import * as dashboardService from "./dashboard.service.js";
import { auth } from "../../middlewares/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard analytics and stats
 */

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get home dashboard statistics
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard stats (Projects, Budget, Inventory)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         completed:
 *                           type: integer
 *                     financials:
 *                       type: object
 *                       properties:
 *                         totalBudget:
 *                           type: number
 *                         currency:
 *                           type: string
 *                     inventory:
 *                       type: object
 *                       properties:
 *                         lowStockCount:
 *                           type: integer
 *                         status:
 *                           type: string
 */
router.get("/stats", auth, dashboardService.getDashboardStats);

export default router;
