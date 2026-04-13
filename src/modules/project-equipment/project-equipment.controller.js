import { Router } from "express";
import * as projectEquipmentService from "./project-equipment.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Equipment
 *   description: |
 *     إدارة المعدات داخل المشروع يدوياً (بعد الإنشاء).
 *
 *     **الفرق بين طريقتين:**
 *     - **وقت إنشاء المشروع** → ابعت `equipments[]` في `POST /api/projects`
 *     - **بعد الإنشاء (يدوي)** → استخدم `POST /api/projects/:projectId/equipment`
 *
 *     كل إضافة أو حذف بيحدّث `estimatedCost` في المشروع تلقائياً.
 */

/**
 * @swagger
 * /projects/{projectId}/equipment:
 *   get:
 *     summary: Get all equipment for a project
 *     tags: [Project Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of equipment items in the project
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
 *                       _id: { type: string }
 *                       name: { type: string, example: "رافعة" }
 *                       count: { type: integer, example: 2 }
 *                       unit: { type: string, example: "وحدة" }
 *                       ownershipType: { type: string, enum: [OWNED, RENTED, BORROWED] }
 *                       unitCost: { type: number, example: 500 }
 *                       totalCost: { type: number, example: 1000, description: "unitCost × count (محسوب تلقائياً)" }
 *                       status: { type: string, enum: [PENDING, ACTIVE, RELEASED] }
 *   post:
 *     summary: Add equipment to project (من الأسطول أو يدوي)
 *     description: |
 *       ## يدعم طريقتين تماماً زي المواد:
 *
 *       ### Mode 1: من أسطول الشركة (مثل المواد تماماً)
 *       ابعت `equipmentId` من `/api/equipment` ← بيجيب الاسم والتكلفة اليومية أوتوماتيك
 *       ```json
 *       {
 *         "equipmentId": "64a2f1c3e21b4a0012345678",
 *         "count": 2,
 *         "startDate": "2025-05-01",
 *         "endDate": "2025-06-30"
 *       }
 *       ```
 *       → `unitCost = dailyCost × (endDate - startDate)` محسوب تلقائياً
 *       → `totalCost = unitCost × count`
 *
 *       ### Mode 2: إدخال يدوي (معدة مستأجرة أو غير موجودة في الأسطول)
 *       ```json
 *       {
 *         "name": "رافعة مستأجرة",
 *         "count": 1,
 *         "unitCost": 500,
 *         "ownershipType": "RENTED"
 *       }
 *       ```
 *
 *       في كلا الحالتين: `estimatedCost` في المشروع يُحدَّث تلقائياً ✅
 *     tags: [Project Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               equipmentId:
 *                 type: string
 *                 description: "🔗 Mode 1 — Equipment ObjectId من GET /api/equipment (يُغني عن name و unitCost)"
 *                 example: "64a2f1c3e21b4a0012345678"
 *               name:
 *                 type: string
 *                 description: "✍️ Mode 2 — اسم المعدة (مطلوب لو مفيش equipmentId)"
 *                 example: "رافعة مستأجرة"
 *               count:
 *                 type: integer
 *                 default: 1
 *                 example: 2
 *               unit:
 *                 type: string
 *                 default: "وحدة"
 *               ownershipType:
 *                 type: string
 *                 enum: [OWNED, RENTED, BORROWED]
 *                 default: OWNED
 *               location:
 *                 type: string
 *                 example: "الموقع ب"
 *               unitCost:
 *                 type: number
 *                 description: "Mode 2: سعر الوحدة. Mode 1: يُحسب من dailyCost × أيام التشغيل (override اختياري)"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: "Mode 1 فقط — تاريخ بداية استخدام المعدة (default: startDate المشروع)"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: "Mode 1 فقط — تاريخ نهاية استخدام المعدة (default: endDate المشروع)"
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE, RELEASED]
 *                 default: PENDING
 *     responses:
 *       201:
 *         description: Equipment added + estimatedCost updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     equipmentRef: { type: object, description: "بيانات المعدة من الأسطول (Mode 1 فقط)" }
 *                     name: { type: string }
 *                     count: { type: integer }
 *                     unitCost: { type: number }
 *                     totalCost: { type: number }
 *       404:
 *         description: Project or Equipment not found
 */
router.get("/:projectId/equipment", auth, permission("VIEW_REPORTS"), projectEquipmentService.getProjectEquipment);
router.post("/:projectId/equipment", auth, permission("UPDATE_PROJECT"), projectEquipmentService.addProjectEquipment);

/**
 * @swagger
 * /projects/{projectId}/equipment/{id}:
 *   put:
 *     summary: Update equipment details (name, count, cost, status)
 *     description: |
 *       تحديث بيانات معدة في المشروع.
 *       لو تغيّر `unitCost` أو `count` → يعيد حساب `totalCost` ويحدّث `estimatedCost` في المشروع.
 *     tags: [Project Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
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
 *               name: { type: string }
 *               count: { type: integer }
 *               unit: { type: string }
 *               ownershipType: { type: string, enum: [OWNED, RENTED, BORROWED] }
 *               location: { type: string }
 *               unitCost: { type: number }
 *               status: { type: string, enum: [PENDING, ACTIVE, RELEASED] }
 *     responses:
 *       200: { description: Equipment updated and estimatedCost recalculated }
 *   delete:
 *     summary: Remove equipment from project
 *     description: يحذف المعدة ويخصم تكلفتها من `estimatedCost` في المشروع تلقائياً.
 *     tags: [Project Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Equipment removed and cost deducted from project }
 */
router.put("/:projectId/equipment/:id", auth, permission("UPDATE_PROJECT"), projectEquipmentService.updateProjectEquipment);
router.delete("/:projectId/equipment/:id", auth, permission("UPDATE_PROJECT"), projectEquipmentService.removeProjectEquipment);

export default router;
