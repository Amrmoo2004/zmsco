import { Router } from "express";
import * as goodsReceiptService from "./goodsReceipt.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Goods Receipts
 *   description: Goods Receipt Notes (GRN) per Purchase Order
 *
 * /purchase-orders/{poId}/receipts:
 *   get:
 *     summary: Get all goods receipts for a PO
 *     tags: [Goods Receipts]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: poId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: List of receipts }
 *   post:
 *     summary: Record a goods receipt (incoming delivery)
 *     tags: [Goods Receipts]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: poId, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               deliveryNoteNumber: { type: string }
 *               warehouse: { type: string }
 *               notes: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string }
 *                     orderedQuantity: { type: number }
 *                     receivedQuantity: { type: number }
 *     responses:
 *       201: { description: Goods receipt recorded }
 *
 * /purchase-orders/{poId}/receipts/summary:
 *   get:
 *     summary: Get receipt summary for the PO progress bar
 *     tags: [Goods Receipts]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: poId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Aggregated received quantities per material }
 */

// GoodsReceipts per PO
router.get("/", auth, goodsReceiptService.getReceiptsByPO);
router.post("/", auth, permission("UPDATE_PROJECT"), goodsReceiptService.createReceipt);
router.get("/summary", auth, goodsReceiptService.getReceiptSummary);

export default router;
