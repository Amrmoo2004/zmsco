import { Router } from "express";
import * as procurementService from "./procurement.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Procurement
 *   description: RFQ, Quotes, PO, and Goods Receipt
 */

/**
 * @swagger
 * /procurement/rfq:
 *   post:
 *     summary: "إنشاء طلب عرض سعر (RFQ) - الخطوة 1 من 3 في المعالج"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
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
 *                 description: "المواد والكميات المطلوبة"
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string, description: "MongoDB ObjectId للمادة" }
 *                     quantity: { type: number }
 *               suppliers:
 *                 type: array
 *                 description: "قائمة الموردين المختارين (الخطوة 2 في المعالج)"
 *                 items: { type: string, description: "MongoDB ObjectId للمورد" }
 *               project:
 *                 type: string
 *                 description: "MongoDB ObjectId للمشروع (اختياري)"
 *               phase:
 *                 type: string
 *                 description: "MongoDB ObjectId للمرحلة (اختياري)"
 *               warehouse:
 *                 type: string
 *                 description: "MongoDB ObjectId للمستودع (اختياري)"
 *               deadline:
 *                 type: string
 *                 format: date
 *                 description: "تاريخ انتهاء صلاحية الطلب"
 *     responses:
 *       201: { description: "تم إنشاء RFQ بنجاح" }
 *   get:
 *     summary: "قائمة جميع RFQs مع عدد العروض لكل واحد"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *         description: "فلترة بالمشروع"
 *     responses:
 *       200: { description: "قائمة RFQs" }
 */
router.post("/rfq", auth, permission("CREATE_RFQ"), procurementService.createRFQ);
router.get("/rfq", auth, permission("VIEW_REPORTS"), procurementService.getRFQs);

/**
 * @swagger
 * /procurement/rfq/{rfqId}/quotes:
 *   post:
 *     summary: "المورد يبعت عرض سعر على RFQ معين"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: rfqId
 *         required: true
 *         schema: { type: string }
 *         description: "MongoDB ObjectId لطلب العرض"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supplierId
 *               - items
 *             properties:
 *               supplierId:
 *                 type: string
 *                 description: "MongoDB ObjectId للمورد"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string, description: "MongoDB ObjectId" }
 *                     quantity: { type: number }
 *                     unitPrice: { type: number }
 *                     description: { type: string }
 *               deliveryDays:
 *                 type: number
 *                 description: "مدة التسليم بالأيام"
 *               paymentTerms:
 *                 type: string
 *                 description: "شروط الدفع"
 *               validityDays:
 *                 type: number
 *                 description: "صلاحية العرض بالأيام"
 *               notes:
 *                 type: string
 *     responses:
 *       201: { description: "تم إرسال العرض بنجاح" }
 *       400: { description: "المورد أرسل عرضاً بالفعل لهذا الطلب" }
 *   get:
 *     summary: "جلب جميع العروض لـ RFQ معين للمقارنة"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: rfqId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "العروض مع بيانات المقارنة (isBestPrice, savingsVsBest)"
 */
router.post("/rfq/:rfqId/quotes", auth, permission("CREATE_RFQ"), procurementService.submitQuote);
router.get("/rfq/:rfqId/quotes", auth, permission("VIEW_REPORTS"), procurementService.getRFQQuotes);

/**
 * @swagger
 * /procurement/rfq/{rfqId}/quotes/{quoteId}/select:
 *   patch:
 *     summary: "اختيار عرض سعر وإنشاء أمر شراء (PO) أوتوماتيك"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: rfqId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: quoteId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deliveryDate:
 *                 type: string
 *                 format: date
 *               paymentTerms:
 *                 type: string
 *               warehouse:
 *                 type: string
 *                 description: "MongoDB ObjectId للمستودع الوجهة"
 *     responses:
 *       200:
 *         description: "تم اختيار العرض وإنشاء PO تلقائياً — يُرجع { quote, purchaseOrder }"
 */
router.patch("/rfq/:rfqId/quotes/:quoteId/select", auth, permission("CREATE_PO"), procurementService.selectQuote);

/**
 * @swagger
 * /procurement/po:
 *   post:
 *     summary: "إنشاء أمر شراء (PO) يدوياً"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
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
 *                     material: { type: string, description: "MongoDB ObjectId" }
 *                     quantity: { type: number }
 *                     unitPrice: { type: number }
 *     responses:
 *       201: { description: "تم إنشاء PO" }
 *   get:
 *     summary: "قائمة أوامر الشراء"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *         description: "فلترة بالمشروع"
 *     responses:
 *       200: { description: "قائمة POs" }
 */
router.post("/po", auth, permission("CREATE_PO"), procurementService.createPO);
router.get("/po", auth, permission("VIEW_REPORTS"), procurementService.getPOs);

/**
 * @swagger
 * /procurement/receive/{poId}:
 *   post:
 *     summary: "استلام البضاعة وتحديث المخزون أوتوماتيك"
 *     tags: [Procurement]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: poId
 *         required: true
 *         schema: { type: string }
 *         description: "MongoDB ObjectId لأمر الشراء"
 *     responses:
 *       200: { description: "تم استلام البضاعة وتحديث المخزون" }
 *       400: { description: "تم استلام هذا الأمر مسبقاً" }
 */
router.post("/receive/:poId", auth, permission("RECEIVE_GOODS"), procurementService.receiveGoods);

export default router;

