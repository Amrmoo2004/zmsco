import { Router } from "express";
import * as procurementService from "./procurement.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Procurement
 *   description: RFQ, PO, and Goods Receipt
 */

/**
 * @swagger
 * /procurement/rfq:
 *   post:
 *     summary: Create RFQ
 *     tags: [Procurement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string }
 *                     quantity: { type: number }
 *               deadline: { type: string, format: date }
 *     responses:
 *       201: { description: RFQ Created }
 *   get:
 *     summary: List RFQs
 *     tags: [Procurement]
 *     responses:
 *       200: { description: List of RFQs }
 */
// RFQ Management
router.post(
    "/rfq",
    auth,
    permission("CREATE_RFQ"), // Ensure this permission exists or use CREATE_PROJECT for now
    procurementService.createRFQ
);
router.get("/rfq", auth, permission("VIEW_REPORTS"), procurementService.getRFQs);

/**
 * @swagger
 * /procurement/po:
 *   post:
 *     summary: Create Purchase Order from RFQ
 *     tags: [Procurement]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rfqId
 *               - supplierId
 *               - items
 *             properties:
 *               rfqId: { type: string }
 *               supplierId: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string }
 *                     quantity: { type: number }
 *                     unitPrice: { type: number }
 *     responses:
 *       201: { description: PO Created }
 *   get:
 *     summary: List Purchase Orders
 *     tags: [Procurement]
 *     responses:
 *       200: { description: List of POs }
 */
// PO Management
router.post(
    "/po",
    auth,
    permission("CREATE_PO"),
    procurementService.createPO
);
router.get("/po", auth, permission("VIEW_REPORTS"), procurementService.getPOs);

/**
 * @swagger
 * /procurement/receive/{poId}:
 *   post:
 *     summary: Receive Goods (Update Inventory)
 *     tags: [Procurement]
 *     parameters:
 *       - in: path
 *         name: poId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Inventory Updated }
 */
// Receive Goods
router.post(
    "/receive/:poId",
    auth,
    permission("RECEIVE_GOODS"),
    procurementService.receiveGoods
);

export default router;
