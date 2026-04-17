import { Router } from "express";
import * as materialRequestService from "./material-request.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Material Requests
 *   description: موافقات صرف المواد — Material Issue Requests
 */

/**
 * @swagger
 * /material-requests:
 *   get:
 *     summary: قائمة طلبات صرف المواد
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PENDING_APPROVAL, APPROVED, REJECTED, FULFILLED] }
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *         description: "MongoDB ObjectId للمشروع"
 *       - in: query
 *         name: phase
 *         schema: { type: string }
 *         description: "MongoDB ObjectId للمرحلة"
 *       - in: query
 *         name: warehouse
 *         schema: { type: string }
 *         description: "MongoDB ObjectId للمستودع"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: قائمة الطلبات مع pagination
 *
 *   post:
 *     summary: إنشاء طلب صرف مواد جديد (3 خطوات)
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       ## 🧱 Modal Flow — 3 خطوات
 *
 *       | الخطوة | البيانات |
 *       |--------|----------|
 *       | **1** اختر المستودع | `warehouse` من `GET /api/warehouses` |
 *       | **2** اختر المواد والكميات | `materials[]` من `GET /api/materials` |
 *       | **3** مراجعة وإرسال | `notes` (اختياري) |
 *
 *       **ملاحظة:** `unitCost` و `totalCost` يُحسبان تلقائياً من `standardCost` الخاص بكل مادة.
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project
 *               - warehouse
 *               - materials
 *             properties:
 *               project:
 *                 type: string
 *                 description: "MongoDB ObjectId — GET /api/projects"
 *                 example: "64a2f1c3e21b4a0012345678"
 *               warehouse:
 *                 type: string
 *                 description: "المستودع المصدر — GET /api/warehouses (Step 1)"
 *                 example: "64a2f1c3e21b4a0012345690"
 *               phase:
 *                 type: string
 *                 description: "MongoDB ObjectId للمرحلة (اختياري)"
 *               materials:
 *                 type: array
 *                 description: "قائمة المواد المطلوبة (Step 2)"
 *                 items:
 *                   type: object
 *                   required: [material, quantity]
 *                   properties:
 *                     material:
 *                       type: string
 *                       description: "MongoDB ObjectId — GET /api/materials"
 *                       example: "64a2f1c3e21b4a0012345601"
 *                     quantity:
 *                       type: number
 *                       minimum: 1
 *                       example: 3
 *               notes:
 *                 type: string
 *                 description: "ملاحظات (اختياري — Step 3)"
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     requestNumber: { type: string, example: "MAT-2025-001" }
 *                     status: { type: string, example: "PENDING" }
 *                     totalRequestCost: { type: number, example: 3935 }
 */
router.get("/", auth, permission("VIEW_REPORTS"), materialRequestService.getAllRequests);
router.post("/", auth, materialRequestService.createRequest);

/**
 * @swagger
 * /material-requests/{id}:
 *   get:
 *     summary: تفاصيل طلب صرف المواد (مع فحص التوافر الفعلي)
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: |
 *           تفاصيل الطلب. كل مادة تتضمن:
 *           - `availableQuantity` الكمية المتاحة في المستودع المختار
 *           - `isAvailable` هل الكمية كافية
 *           - `availabilityStatus` AVAILABLE | INSUFFICIENT
 *   put:
 *     summary: تعديل طلب (PENDING أو PENDING_APPROVAL فقط)
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               warehouse: { type: string }
 *               phase: { type: string }
 *               notes: { type: string }
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string }
 *                     quantity: { type: number }
 *     responses:
 *       200: { description: Updated request }
 *   delete:
 *     summary: حذف طلب (PENDING أو PENDING_APPROVAL فقط)
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), materialRequestService.getRequestById);
router.put("/:id", auth, materialRequestService.updateRequest);
router.delete("/:id", auth, materialRequestService.deleteRequest);

/**
 * @swagger
 * /material-requests/{id}/approve:
 *   patch:
 *     summary: الموافقة على طلب صرف المواد
 *     description: |
 *       إذا لم يكن هناك Workflow → موافقة فورية.
 *       إذا كان هناك Workflow → تُسجَّل موافقة الخطوة الحالية وتنتقل للتالية.
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments: { type: string, description: "ملاحظات اختيارية" }
 *     responses:
 *       200: { description: تم الاعتماد }
 */
router.patch("/:id/approve", auth, permission("APPROVE_MATERIAL_REQUEST"), materialRequestService.approveRequest);

/**
 * @swagger
 * /material-requests/{id}/reject:
 *   patch:
 *     summary: رفض طلب صرف المواد
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: "سبب الرفض" }
 *     responses:
 *       200: { description: تم الرفض }
 */
router.patch("/:id/reject", auth, permission("APPROVE_MATERIAL_REQUEST"), materialRequestService.rejectRequest);

/**
 * @swagger
 * /material-requests/{id}/fulfill:
 *   patch:
 *     summary: صرف المواد للمشروع (الموافقة والصرف)
 *     description: |
 *       يُخصم المواد من المستودع المُحدد في الطلب ويُنشئ Material Transaction.
 *       يُرسل تنبيه تلقائي لو المخزون انخفض عن الحد الأدنى.
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: تم الصرف بنجاح }
 *       400: { description: مخزون غير كافٍ أو الطلب غير معتمد }
 */
router.patch("/:id/fulfill", auth, permission("FULFILL_MATERIAL_REQUEST"), materialRequestService.fulfillRequest);

/**
 * @swagger
 * /material-requests/projects/{projectId}/tracking:
 *   get:
 *     summary: تتبع استهلاك المواد لمشروع معين
 *     tags: [Material Requests]
 *     security: [{ bearerAuth: [] }]
 *     description: |
 *       يعرض لكل مادة في المشروع:
 *       - الكمية المخططة / المعتمدة / المصروفة فعلياً
 *       - التكلفة المخططة / المعتمدة / المصروفة
 *       - نسبة الصرف من المسموح (consumptionRate)
 *       - نسبة الصرف من الطلبية (planRate)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: "MongoDB ObjectId للمشروع"
 *     responses:
 *       200:
 *         description: بيانات تتبع الاستهلاك
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       type: object
 *                       properties:
 *                         totalPlannedCost: { type: number }
 *                         totalApprovedCost: { type: number }
 *                         totalIssuedCost: { type: number }
 *                         remainingBudget: { type: number }
 *                         overallRate: { type: number, description: "% الاستهلاك الإجمالي" }
 *                     materials:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           plannedQty: { type: number }
 *                           approvedQty: { type: number }
 *                           issuedQty: { type: number }
 *                           consumptionRate: { type: number, description: "% من المعتمد" }
 *                           planRate: { type: number, description: "% من المخطط" }
 *                           status: { type: string, enum: [NOT_STARTED, PARTIALLY_CONSUMED, FULLY_CONSUMED] }
 */
router.get(
  "/projects/:projectId/tracking",
  auth,
  permission("VIEW_REPORTS"),
  materialRequestService.getProjectMaterialTracking
);

export default router;
