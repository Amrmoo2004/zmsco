import { Router } from "express";
import * as warehouseService from "./warehouse.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Warehouses
 *   description: |
 *     Warehouse management APIs. Used in **Step 4 of the Project Creation Wizard** (المستودعات والمعاملات).
 *
 *     ### How Step 4 Works (Frontend Flow):
 *     1. **GET /api/warehouses** → Populate the warehouse dropdown (shows capacity %)
 *     2. User picks warehouse type:
 *        - `SHARED` → No dedicated warehouse needed
 *        - `DEDICATED` → Select existing warehouse from dropdown using its `_id`
 *     3. **GET /api/warehouses/:id** → Show the selected warehouse card (capacity bar, items count)
 *     4. User fills `initialTransfers[]` (material + quantity + fromWarehouse)
 *     5. **PUT /api/projects/:id** → Save warehouse config to the DRAFT project
 *     6. **POST /api/projects/:id/activate** → Executes the transfers & sets status to PLANNING
 */

/**
 * @swagger
 * /warehouses:
 *   get:
 *     summary: Get all warehouses (for dropdown in Step 4)
 *     description: |
 *       Returns all warehouses with capacity stats.
 *       Each item includes `capacityPercentage` for the progress bar display.
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of warehouses with capacity info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string, description: "Use this as dedicatedWarehouse or sourceWarehouse in project creation" }
 *                       name: { type: string, example: "المستودع الرئيسي" }
 *                       location: { type: string }
 *                       type: { type: string, enum: [MAIN, PROJECT] }
 *                       capacity: { type: number, example: 1000 }
 *                       usedCapacity: { type: number, example: 850 }
 *                       capacityPercentage: { type: number, example: 85, description: "% used — use for progress bar display" }
 *                       inventoryItemsCount: { type: number, example: 2, description: "عدد العمليات المضافة" }
 *                       transactionsCount: { type: number, example: 5, description: "عدد المعاملات الإجمالية" }
 *                       manager: { type: object, properties: { _id: { type: string }, name: { type: string } } }
 *   post:
 *     summary: Create a new warehouse
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "مستودع الموقع ب" }
 *               location: { type: string, example: "حي الصناعية - الرياض" }
 *               capacity: { type: number, example: 5000, description: "Max capacity in units" }
 *               manager: { type: string, description: "Manager User ObjectId - GET /api/users" }
 *     responses:
 *       201: { description: Warehouse created successfully }
 */
router.get("/", auth, permission("VIEW_INVENTORY"), warehouseService.getAllWarehouses);
router.post("/", auth, permission("MANAGE_INVENTORY"), warehouseService.createWarehouse);

/**
 * @swagger
 * /warehouses/{id}:
 *   get:
 *     summary: Get warehouse details with live capacity stats (for the warehouse card in Step 4)
 *     description: |
 *       Returns full warehouse details + computed stats:
 *       - `capacityPercentage` → drives the progress bar (e.g. 85%)
 *       - `inventoryItemsCount` → "عدد العمليات المضافة"
 *       - `transactionsCount` → total IN/OUT/TRANSFER operations
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Warehouse details with capacity stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     name: { type: string }
 *                     location: { type: string }
 *                     type: { type: string, enum: [MAIN, PROJECT] }
 *                     capacity: { type: number, example: 1000 }
 *                     usedCapacity: { type: number, example: 850 }
 *                     capacityPercentage:
 *                       type: number
 *                       example: 85
 *                       description: "% of capacity used — drive the progress bar with this value"
 *                     inventoryItemsCount:
 *                       type: number
 *                       example: 2
 *                       description: "عدد العمليات المضافة — shown under the progress bar"
 *                     transactionsCount:
 *                       type: number
 *                       example: 5
 *                       description: "Total IN/OUT/TRANSFER transactions for this warehouse"
 *                     manager: { type: object }
 *       404: { description: Warehouse not found }
 *   put:
 *     summary: Update warehouse
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               location: { type: string }
 *               capacity: { type: number }
 *               manager: { type: string, description: "User ObjectId" }
 *     responses:
 *       200: { description: Warehouse updated }
 *   delete:
 *     summary: Delete warehouse (only if no inventory exists)
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Warehouse deleted }
 *       400: { description: Cannot delete warehouse with existing inventory }
 */
router.get("/:id", auth, permission("VIEW_INVENTORY"), warehouseService.getWarehouseById);
router.put("/:id", auth, permission("MANAGE_INVENTORY"), warehouseService.updateWarehouse);
router.delete("/:id", auth, permission("MANAGE_INVENTORY"), warehouseService.deleteWarehouse);

/**
 * @swagger
 * /warehouses/{id}/inventory:
 *   get:
 *     summary: Get current inventory items in a warehouse
 *     description: Returns all materials and their quantities currently stored in this warehouse.
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Inventory list for the warehouse
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     warehouse: { type: object, properties: { id: { type: string }, name: { type: string } } }
 *                     inventory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           material: { type: object, properties: { _id: { type: string }, name: { type: string }, unit: { type: object } } }
 *                           quantity: { type: number }
 */
router.get("/:id/inventory", auth, permission("VIEW_INVENTORY"), warehouseService.getWarehouseInventory);

/**
 * @swagger
 * /warehouses/{id}/transactions:
 *   get:
 *     summary: Get transaction history for a warehouse (IN / OUT / TRANSFER)
 *     description: |
 *       Returns all material movement logs for the given warehouse.
 *       Use `?type=TRANSFER` to filter only initial transfer logs during project activation.
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [IN, OUT, TRANSFER] }
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     warehouse: { type: object }
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           material: { type: object }
 *                           type: { type: string, enum: [IN, OUT, TRANSFER] }
 *                           quantity: { type: number }
 *                           fromWarehouse: { type: string }
 *                           toWarehouse: { type: string }
 *                           project: { type: object }
 *                           createdAt: { type: string, format: date-time }
 *       404: { description: Warehouse not found }
 */
router.get("/:id/transactions", auth, permission("VIEW_INVENTORY"), warehouseService.getWarehouseTransactions);

/**
 * @swagger
 * /warehouses/{id}/dashboard:
 *   get:
 *     summary: "داشبورد المخزن — كروت الإحصائيات + توزيع المخزون + آخر التحويلات"
 *     description: |
 *       يُرجع كل البيانات اللازمة لشاشتي المخزن في الـ UI:
 *
 *       **شاشة المخزن الرئيسي:**
 *       - `summary.totalMaterials` → إجمالي المواد (12,450)
 *       - `summary.lowStockCount` → تنبيهات انخفاض المخزون (24)
 *       - `summary.activeTransfersCount` → التحويلات النشطة (8)
 *       - `summary.unavailableCount` → المواد غير المتوفرة (12)
 *       - `projectDistribution` → بيانات الـ Pie Chart (توزيع المخزون)
 *       - `recentTransactions` → قائمة آخر التحويلات
 *
 *       **شاشة مخزن المشروع:**
 *       - `summary.dailyConsumptionRate` → معدل الاستهلاك اليومي %
 *       - `summary.incomingToday` → شحنات قادمة اليوم
 *       - `summary.totalMaterials` → إجمالي المواد
 *       - `summary.lowStockCount` → مواد أوشكت على النفاد
 *     tags: [Warehouses]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: "Warehouse ObjectId (رئيسي أو مشروع)"
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     warehouse: { type: object }
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalMaterials: { type: number, example: 12450 }
 *                         lowStockCount: { type: number, example: 24 }
 *                         unavailableCount: { type: number, example: 12 }
 *                         activeTransfersCount: { type: number, example: 8 }
 *                         dailyConsumptionRate: { type: number, example: 85, description: "% — for معدل الاستهلاك اليومي" }
 *                         incomingToday: { type: number, example: 4, description: "شحنات قادمة اليوم" }
 *                         inventoryItemsCount: { type: number }
 *                     projectDistribution:
 *                       type: array
 *                       description: "for Pie Chart — توزيع المخزون"
 *                       items:
 *                         type: object
 *                         properties:
 *                           projectName: { type: string }
 *                           total: { type: number }
 *                     recentTransactions:
 *                       type: array
 *                       description: "آخر 10 تحويلات"
 *       404: { description: Warehouse not found }
 */
router.get("/:id/dashboard", auth, permission("VIEW_INVENTORY"), warehouseService.getWarehouseDashboard);

export default router;
