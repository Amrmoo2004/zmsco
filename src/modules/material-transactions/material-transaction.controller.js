import { Router } from "express";
import * as materialTransactionService from "./material-transaction.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Material Transactions
 *   description: Material Movement Tracking
 */

/**
 * @swagger
 * /material-transactions:
 *   get:
 *     summary: Get all material transactions
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: material
 *         schema: { type: string }
 *         description: MongoDB ObjectId for material
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *         description: MongoDB ObjectId for project
 *       - in: query
 *         name: warehouse
 *         schema: { type: string }
 *         description: MongoDB ObjectId for warehouse
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [IN, OUT] }
 *     responses:
 *       200: { description: List of transactions }
 *   post:
 *     summary: Add or withdraw materials from a warehouse
 *     description: |
 *       ## 3 سيناريوهات للاستخدام:
 *
 *       ### 1️⃣ استلام مواد من مورد (IN بدون مشروع)
 *       ```json
 *       [{ "material": "<id>", "quantity": 100, "type": "IN", "warehouse": "<mainWarehouseId>",
 *          "notes": "استلام من مورد الحديد" }]
 *       ```
 *       → `project` **فاضي** — استلام عادي يزيد المخزون ✅
 *
 *       ### 2️⃣ صرف مواد من المستودع لمشروع (OUT مع مشروع)
 *       ```json
 *       [{ "material": "<id>", "quantity": 20, "type": "OUT",
 *          "warehouse": "<mainWarehouseId>", "project": "<projectId>",
 *          "notes": "صرف للمشروع" }]
 *       ```
 *       → `project` **موجود** — يُخصم من المخزون ويُربط بالمشروع للتقارير 📊
 *
 *       ### 3️⃣ إرجاع مواد من مشروع للمستودع (IN مع مشروع)
 *       ```json
 *       [{ "material": "<id>", "quantity": 5, "type": "IN",
 *          "warehouse": "<mainWarehouseId>", "project": "<projectId>",
 *          "notes": "إرجاع فائض من المشروع" }]
 *       ```
 *       → يزيد المخزون ويُسجَّل كإرجاع مرتبط بالمشروع
 *
 *       ---
 *       ⚠️ **ملاحظة:** هذه الـ API للحركات اليدوية.
 *       الـ `initialTransfers` في project activation تتم تلقائياً عبر `POST /api/projects/:id/activate`
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             receive_from_supplier:
 *               summary: "استلام من مورد (IN)"
 *               value:
 *                 - material: "64a2f1c3e21b4a0012345678"
 *                   quantity: 100
 *                   type: "IN"
 *                   warehouse: "64a2f1c3e21b4a0099999999"
 *                   notes: "استلام دفعة حديد من مورد الرياض"
 *             withdraw_to_project:
 *               summary: "صرف لمشروع (OUT)"
 *               value:
 *                 - material: "64a2f1c3e21b4a0012345678"
 *                   quantity: 20
 *                   type: "OUT"
 *                   warehouse: "64a2f1c3e21b4a0099999999"
 *                   project: "69cfe5865967dfc2d7067624"
 *                   notes: "صرف للمشروع A"
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [material, quantity, type, warehouse]
 *               properties:
 *                 material:
 *                   type: string
 *                   description: "Material ObjectId — GET /api/materials"
 *                   example: "64a2f1c3e21b4a0012345678"
 *                 quantity:
 *                   type: number
 *                   example: 100
 *                 type:
 *                   type: string
 *                   enum: [IN, OUT]
 *                   description: |
 *                     - `IN` = إضافة للمخزون (استلام من مورد / إرجاع من مشروع)
 *                     - `OUT` = سحب من المخزون (صرف لمشروع / نقل)
 *                 warehouse:
 *                   type: string
 *                   description: "Warehouse ObjectId — GET /api/warehouses"
 *                   example: "64a2f1c3e21b4a0099999999"
 *                 project:
 *                   type: string
 *                   nullable: true
 *                   description: |
 *                     **اختياري** — Project ObjectId من GET /api/projects
 *                     - **فاضي**: استلام عادي من مورد (لا علاقة بمشروع)
 *                     - **موجود**: يربط الحركة بالمشروع → يظهر في تقرير المشروع وتكاليفه
 *                   example: "69cfe5865967dfc2d7067624"
 *                 notes:
 *                   type: string
 *                   description: "اختياري — ملاحظات على الحركة"
 *                   example: "استلام من مورد الرياض"
 *                 referenceRequest:
 *                   type: string
 *                   nullable: true
 *                   description: |
 *                     **اختياري** — Material Request ObjectId (من GET /api/stock/request)
 *                     يُرسَل لو الحركة ناتجة عن طلب صرف معتمد
 *     responses:
 *       201:
 *         description: Transactions created and inventory updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array }
 */
router.get("/", auth, permission("VIEW_REPORTS"), materialTransactionService.getAllTransactions);
router.post("/", auth, permission("CREATE_PROJECT"), materialTransactionService.createTransaction);

/**
 * @swagger
 * /material-transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Transaction details }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionById);

/**
 * @swagger
 * /material-transactions/material/{materialId}:
 *   get:
 *     summary: Get transactions by material
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId for material
 *     responses:
 *       200: { description: Material transactions }
 */
router.get("/material/:materialId", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionsByMaterial);

/**
 * @swagger
 * /material-transactions/project/{projectId}:
 *   get:
 *     summary: Get transactions by project
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId for project
 *     responses:
 *       200: { description: Project transactions }
 */
router.get("/project/:projectId", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionsByProject);

export default router;
