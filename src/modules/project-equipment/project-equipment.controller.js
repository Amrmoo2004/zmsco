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
 *     ## إدارة معدات المشروع
 *
 *     ### متى تستخدم كل API:
 *     | الحالة | الـ API |
 *     |--------|---------|
 *     | وقت إنشاء المشروع | أضف `equipments[]` في `POST /api/projects` |
 *     | بعد الإنشاء — إضافة معدة | `POST /api/projects/:id/equipment` |
 *     | عرض كل معدات المشروع | `GET /api/projects/:id/equipment` |
 *     | تعديل معدة | `PUT /api/projects/:id/equipment/:eqId` |
 *     | حذف معدة | `DELETE /api/projects/:id/equipment/:eqId` |
 *
 *     ### نوعان من المعدات:
 *     - **من الأسطول** → ابعت `equipmentId` من `GET /api/equipment` ← بيانات + تكلفة أوتوماتيك
 *     - **يدوي** → ابعت `name + unitCost` مباشرة (معدة مستأجرة أو خارجية)
 *
 *     ⚡ كل إضافة أو حذف بيُحدّث `estimatedCost` في المشروع تلقائياً.
 */

/**
 * @swagger
 * /projects/{projectId}/equipment:
 *   get:
 *     summary: Get all equipment for a project
 *     description: يرجع قائمة كل المعدات في المشروع مع بيانات الأسطول إن وُجدت (equipmentRef).
 *     tags: [Project Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: Project ObjectId
 *       - in: query
 *         name: phase
 *         schema: { type: string }
 *         description: "Filter by Phase ObjectId"
 *     responses:
 *       200:
 *         description: List of project equipment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       equipmentRef:
 *                         type: object
 *                         nullable: true
 *                         description: "بيانات المعدة من الأسطول (Mode 1 فقط) — null لو أُضيفت يدوياً"
 *                         properties:
 *                           _id: { type: string }
 *                           name: { type: string, example: "رافعة برجية" }
 *                           type: { type: string, example: "Crane" }
 *                           brand: { type: string, example: "Liebherr" }
 *                           condition: { type: string, enum: [EXCELLENT, GOOD, FAIR, POOR, UNDER_MAINTENANCE] }
 *                           dailyCost: { type: number, example: 500 }
 *                       name: { type: string, example: "رافعة برجية" }
 *                       count: { type: integer, example: 2 }
 *                       unit: { type: string, example: "وحدة" }
 *                       ownershipType: { type: string, enum: [OWNED, RENTED, BORROWED] }
 *                       location: { type: string, example: "الموقع ب" }
 *                       unitCost: { type: number, example: 122500, description: "dailyCost × أيام التشغيل" }
 *                       totalCost: { type: number, example: 245000, description: "unitCost × count" }
 *                       status: { type: string, enum: [PENDING, ACTIVE, RELEASED] }
 *   post:
 *     summary: "Add equipment to project — Mode 1: من الأسطول | Mode 2: يدوي"
 *     description: |
 *       ## طريقتان للإضافة:
 *
 *       ---
 *       ### 🔗 Mode 1: من أسطول الشركة (مثل المواد تماماً)
 *       الفرونت يعمل `GET /api/equipment` ← يختار من الـ Dropdown ← يبعت الـ `_id`
 *
 *       ```json
 *       {
 *         "equipmentId": "64a2f1c3e21b4a0012345678",
 *         "count": 2,
 *         "startDate": "2025-05-01",
 *         "endDate": "2025-06-30"
 *       }
 *       ```
 *       **النتيجة:**
 *       - `name` → من الأسطول أوتوماتيك
 *       - `unitCost = dailyCost × عدد الأيام` محسوب
 *       - `totalCost = unitCost × count` محسوب
 *       - `equipmentRef` → مربوط بالأسطول للـ populate
 *
 *       ---
 *       ### ✍️ Mode 2: إدخال يدوي (مستأجر أو خارجي)
 *       معدة مش موجودة في الأسطول — الفرونت يكتب البيانات يدوياً
 *
 *       ```json
 *       {
 *         "name": "رافعة مستأجرة من شركة X",
 *         "count": 1,
 *         "unitCost": 500,
 *         "ownershipType": "RENTED",
 *         "location": "الموقع ب"
 *       }
 *       ```
 *       **النتيجة:**
 *       - `totalCost = unitCost × count` محسوب
 *       - `equipmentRef` → null
 *
 *       ---
 *       ⚡ **في كلا الحالتين:** `project.estimatedCost` يُحدَّث تلقائياً بعد الإضافة.
 *     tags: [Project Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: Project ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             mode1_from_fleet:
 *               summary: "Mode 1 — من الأسطول (يُفضَّل)"
 *               value:
 *                 equipmentId: "64a2f1c3e21b4a0012345678"
 *                 count: 2
 *                 startDate: "2025-05-01"
 *                 endDate: "2025-06-30"
 *             mode2_manual:
 *               summary: "Mode 2 — يدوي (مستأجر)"
 *               value:
 *                 name: "رافعة مستأجرة"
 *                 count: 1
 *                 unitCost: 500
 *                 ownershipType: "RENTED"
 *                 location: "الموقع ب"
 *           schema:
 *             type: object
 *             properties:
 *               equipmentId:
 *                 type: string
 *                 description: |
 *                   🔗 **Mode 1** — Equipment ObjectId من `GET /api/equipment`
 *                   إذا وُجد: يُجلب الاسم والتكلفة اليومية تلقائياً.
 *                   يُغني عن `name` و `unitCost`.
 *                 example: "64a2f1c3e21b4a0012345678"
 *               phase:
 *                 type: string
 *                 description: "اختياري — Phase ObjectId لربط المعدة بمرحلة معينة"
 *               name:
 *                 type: string
 *                 description: "✍️ **Mode 2** — اسم المعدة. مطلوب إذا لم يُرسَل `equipmentId`."
 *                 example: "رافعة مستأجرة من شركة X"
 *               count:
 *                 type: integer
 *                 default: 1
 *                 example: 2
 *                 description: عدد الوحدات
 *               unit:
 *                 type: string
 *                 default: "وحدة"
 *                 example: "وحدة"
 *               ownershipType:
 *                 type: string
 *                 enum: [OWNED, RENTED, BORROWED]
 *                 default: OWNED
 *                 description: |
 *                   - `OWNED` = مملوك للشركة
 *                   - `RENTED` = مستأجر (بتكلفة يومية)
 *                   - `BORROWED` = مستعار مؤقتاً
 *               location:
 *                 type: string
 *                 example: "الموقع ب"
 *                 description: الموقع الحالي للمعدة
 *               unitCost:
 *                 type: number
 *                 description: |
 *                   - **Mode 1:** اختياري — يُحسب تلقائياً `dailyCost × أيام التشغيل`. أرسله لتجاوز الحساب التلقائي.
 *                   - **Mode 2:** سعر الوحدة الواحدة (مطلوب للحساب).
 *                 example: 500
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: "**Mode 1 فقط** — بداية فترة استخدام المعدة. Default: startDate المشروع"
 *                 example: "2025-05-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: "**Mode 1 فقط** — نهاية فترة استخدام المعدة. Default: endDate المشروع"
 *                 example: "2025-06-30"
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE, RELEASED]
 *                 default: PENDING
 *     responses:
 *       201:
 *         description: تمت الإضافة وتحديث estimatedCost في المشروع
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Equipment added to project successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     equipmentRef:
 *                       type: object
 *                       nullable: true
 *                       description: "بيانات من الأسطول — موجود في Mode 1 فقط"
 *                       properties:
 *                         _id: { type: string }
 *                         name: { type: string }
 *                         dailyCost: { type: number }
 *                         condition: { type: string }
 *                     name: { type: string }
 *                     count: { type: integer }
 *                     unitCost: { type: number, description: "محسوب أو مُرسَل" }
 *                     totalCost: { type: number, description: "unitCost × count — محسوب تلقائياً" }
 *                     status: { type: string }
 *       400: { description: "اسم المعدة مطلوب (Mode 2) أو المعدة غير نشطة (Mode 1)" }
 *       404: { description: "المشروع أو المعدة من الأسطول غير موجودة" }
 */
router.get("/:projectId/equipment", auth, permission("VIEW_REPORTS"), projectEquipmentService.getProjectEquipment);
router.post("/:projectId/equipment", auth, permission("UPDATE_PROJECT"), projectEquipmentService.addProjectEquipment);

/**
 * @swagger
 * /projects/{projectId}/equipment/{id}:
 *   put:
 *     summary: Update equipment (name, count, cost, status)
 *     description: |
 *       تحديث بيانات معدة في المشروع.
 *
 *       **حساب تلقائي عند التحديث:**
 *       ```
 *       totalCost = unitCost × count  (يُعاد حسابه)
 *       project.estimatedCost يُعدَّل = القديم - totalCostالقديم + totalCostالجديد
 *       ```
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
 *         description: Equipment item ObjectId (من GET /api/projects/:id/equipment)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, description: "Mode 2 فقط — تغيير الاسم" }
 *               count: { type: integer, example: 3 }
 *               unit: { type: string }
 *               ownershipType: { type: string, enum: [OWNED, RENTED, BORROWED] }
 *               location: { type: string }
 *               unitCost: { type: number, example: 600 }
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE, RELEASED]
 *                 description: |
 *                   - `PENDING` = لم تُستخدم بعد
 *                   - `ACTIVE` = قيد الاستخدام
 *                   - `RELEASED` = أُعيدت / انتهى استخدامها
 *     responses:
 *       200:
 *         description: تم التحديث وإعادة حساب التكاليف
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCost: { type: number, description: "القيمة الجديدة بعد إعادة الحساب" }
 *       404: { description: Equipment not found in project }
 *   delete:
 *     summary: Remove equipment from project
 *     description: |
 *       يحذف المعدة ويطرح `totalCost` منها من `project.estimatedCost` تلقائياً.
 *       ```
 *       project.estimatedCost = project.estimatedCost - equipment.totalCost
 *       ```
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
 *         description: Equipment item ObjectId
 *     responses:
 *       200: { description: Equipment removed and estimatedCost updated }
 *       404: { description: Equipment not found in project }
 */
router.put("/:projectId/equipment/:id", auth, permission("UPDATE_PROJECT"), projectEquipmentService.updateProjectEquipment);
router.delete("/:projectId/equipment/:id", auth, permission("UPDATE_PROJECT"), projectEquipmentService.removeProjectEquipment);

export default router;
