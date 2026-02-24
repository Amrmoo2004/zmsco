import { Router } from "express";
import * as quoteService from "./quote.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Quotes
 *   description: Supplier Quotes / Bids per RFQ
 *
 * /rfqs/{rfqId}/quotes:
 *   get:
 *     summary: Get all quotes for an RFQ (comparison view, sorted by price)
 *     tags: [Quotes]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: rfqId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: List of quotes sorted by totalAmount ascending }
 *   post:
 *     summary: Submit a supplier quote for an RFQ
 *     tags: [Quotes]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: rfqId, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplier, items]
 *             properties:
 *               supplier: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string }
 *                     quantity: { type: number }
 *                     unitPrice: { type: number }
 *               deliveryDays: { type: number }
 *               paymentTerms: { type: string }
 *               validityDays: { type: number }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Quote submitted with auto-calculated total }
 */

// Quotes per RFQ
router.get("/", auth, quoteService.getQuotesByRFQ);
router.post("/", auth, permission("CREATE_PROJECT"), quoteService.submitQuote);

export default router;
