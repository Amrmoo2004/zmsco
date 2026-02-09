import { Router } from "express";
import * as stockService from "./stock.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";
import { PERMISSIONS } from "../../config/permissions.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Stock
 *   description: Inventory and Material Request management
 */

/**
 * @swagger
 * /stock/request:
 *   post:
 *     summary: Create a material request
 *     tags: [Stock]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - items
 *             properties:
 *               projectId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     materialId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *     responses:
 *       201:
 *         description: Request created
 */
router.post(
    "/request",
    auth,
    permission(PERMISSIONS.REQUEST_MATERIAL),
    stockService.createRequest
);

/**
 * @swagger
 * /stock/approve/{requestId}:
 *   post:
 *     summary: Approve a material request and deduct stock
 *     tags: [Stock]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request approved
 */
router.post(
    "/approve/:requestId",
    auth,
    permission(PERMISSIONS.APPROVE_MATERIAL),
    stockService.approveRequest
);

/**
 * @swagger
 * /stock/inventory:
 *   get:
 *     summary: View current inventory levels
 *     tags: [Stock]
 *     responses:
 *       200:
 *         description: Inventory list
 */
router.get(
    "/inventory",
    auth,
    permission(PERMISSIONS.VIEW_INVENTORY),
    stockService.getInventory
);

export default router;
