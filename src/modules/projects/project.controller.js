import express from "express";
import * as projectService from "./project.services.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project Lifecycle Management
 */

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of projects
 *   post:
 *     summary: Create a new project (Step 1 of Wizard)
 *     description: |
 *       ## 🧙 Wizard Flow — 6 خطوات (DEDICATED Warehouse)
 *
 *       | الخطوة | الـ API | البيانات من أين؟ |
 *       |--------|---------|------------------|
 *       | **1** | `POST /api/projects` | فورم الإنشاء (name, type, manager...) |
 *       | **2** | `POST /api/projects/:id/phases` | من Blueprint أو الفرونت يبني يدوياً |
 *       | **3** | `POST /api/projects/:id/members` | قائمة الموظفين من `GET /api/users` |
 *       | **4** | `PUT /api/projects/:id` | قائمة المستودعات من `GET /api/warehouses` |
 *       | **5** | `GET /api/projects/:id/summary` | قراءة فقط — شاشة المراجعة |
 *       | **6** | `POST /api/projects/:id/activate` | زر "تفعيل" — لا يحتاج body |
 *
 *       ---
 *       ## 📦 Step 4 — المستودع (أهم خطوة في DEDICATED)
 *
 *       الفرونت يعمل `GET /api/warehouses` ويعرض للمستخدم خيارين:
 *
 *       **خيار أ: مستودع موجود**
 *       ```json
 *       PUT /api/projects/:id
 *       {
 *         "warehouseType": "DEDICATED",
 *         "dedicatedWarehouse": "<warehouseId من GET /api/warehouses>",
 *         "initialTransfers": [
 *           { "material": "<id>", "quantity": 20, "fromWarehouse": "<id>" }
 *         ]
 *       }
 *       ```
 *       → Step 6 يستخدم المستودع المحدد مباشرة
 *
 *       **خيار ب: مستودع جديد يُنشأ تلقائياً**
 *       ```json
 *       PUT /api/projects/:id
 *       { "warehouseType": "DEDICATED" }
 *       ```
 *       → Step 6 (activate) ينشئ مستودع باسم المشروع تلقائياً
 *
 *       ---
 *       ## ⚡ Shortcut — SHARED فقط (خطوة واحدة)
 *       ابعت `skipActivation: true` في Step 1 ← ينشئ المشروع ويفعّله مباشرة بدون خطوات 4-6
 *
 *     tags: [Projects]

 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             quick_create:
 *               summary: "⚡ إنشاء سريع (SHARED + skipActivation)"
 *               description: "أسرع طريقة — ينشئ المشروع ويفعّله مباشرة"
 *               value:
 *                 name: "مشروع المجمع السكني A"
 *                 type: "69da15bf10cc497e60a12b20"
 *                 manager: "69cfe5865967dfc2d7067624"
 *                 priority: "HIGH"
 *                 startDate: "2025-05-01"
 *                 endDate: "2025-12-31"
 *                 budget: 500000
 *                 warehouseType: "SHARED"
 *                 skipActivation: true
 *                 phases:
 *                   - nameAr: "التخطيط"
 *                     nameEn: "Planning"
 *                     order: 1
 *                     expectedDays: 30
 *                     color: "#3498db"
 *                     tasks:
 *                       - name: "إعداد المخططات"
 *                         isRequired: true
 *                 materials:
 *                   - material: "69da15bf10cc497e60a12b12"
 *                     quantity: 50
 *                     unitCost: 100
 *                 equipments:
 *                   - equipmentId: "64a2f1c3e21b4a0023456789"
 *                     count: 2
 *                 members:
 *                   - role: "مدير المشروع"
 *                     user: "69cfe5865967dfc2d7067624"
 *             wizard_step1_only:
 *               summary: "🪄 Wizard Step 1 فقط (DRAFT — يتكمل لاحقاً)"
 *               description: "ينشئ Draft وترجع projectId لباقي الخطوات"
 *               value:
 *                 name: "مشروع مجمع تجاري B"
 *                 type: "69da15bf10cc497e60a12b20"
 *                 manager: "69cfe5865967dfc2d7067624"
 *                 priority: "MEDIUM"
 *                 startDate: "2025-06-01"
 *                 endDate: "2026-03-31"
 *                 budget: 1200000
 *                 warehouseType: "DEDICATED"
 *                 skipActivation: false
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - manager
 *             properties:
 *               name:
 *                 type: string
 *                 example: "مشروع المجمع السكني A"
 *               type:
 *                 type: string
 *                 description: MongoDB ObjectId for project type (blueprint) - GET /api/project-types
 *                 example: "64a2f1c3e21b4a0012345678"
 *               manager:
 *                 type: string
 *                 description: MongoDB ObjectId for the project manager (User) - GET /api/users
 *                 example: "64a2f1c3e21b4a0012345679"
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-05-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *               department:
 *                 type: string
 *                 description: MongoDB ObjectId for department - GET /api/departments
 *               location:
 *                 type: string
 *                 example: "الرياض، حي العليا"
 *               client:
 *                 type: string
 *                 description: Client name or reference
 *               budget:
 *                 type: number
 *                 example: 500000
 *               description:
 *                 type: string
 *               skipActivation:
 *                 type: boolean
 *                 default: false
 *                 description: "Set true to skip DRAFT and go directly to PLANNING (only works with SHARED warehouse)"
 *               warehouseType:
 *                 type: string
 *                 enum: [SHARED, DEDICATED]
 *                 default: SHARED
 *               dedicatedWarehouse:
 *                 type: string
 *                 description: MongoDB ObjectId for an existing Warehouse (DEDICATED mode)
 *               sourceWarehouse:
 *                 type: string
 *                 description: MongoDB ObjectId for source Warehouse (materials transferred from here on activate)
 *               initialTransfers:
 *                 type: array
 *                 description: Material transfers executed automatically on project activation
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string, description: "Material ObjectId" }
 *                     quantity: { type: number }
 *                     fromWarehouse: { type: string, description: "Source Warehouse ObjectId" }
 *               phases:
 *                 type: array
 *                 description: Optional - if omitted, auto-generated from ProjectType blueprint
 *                 items:
 *                   type: object
 *                   properties:
 *                     nameAr: { type: string, example: "التخطيط" }
 *                     nameEn: { type: string, example: "Planning" }
 *                     order: { type: integer, example: 1 }
 *                     expectedDays: { type: integer, example: 30 }
 *                     color: { type: string, example: "#3498db" }
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           description: { type: string }
 *                           isRequired: { type: boolean }
 *               materials:
 *                 type: array
 *                 description: Optional - if omitted, auto-generated from ProjectType blueprint
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string, description: "Material ObjectId - GET /api/materials" }
 *                     quantity: { type: number }
 *                     unitCost: { type: number }
 *               equipments:
 *                 type: array
 *                 description: |
 *                   اختياري — يدعم طريقتين:
 *                   - **Mode 1 (من الأسطول):** ابعت `equipmentId` من `GET /api/equipment` ← بيجيب الاسم والتكلفة أوتوماتيك
 *                   - **Mode 2 (يدوي):** ابعت `name` + `unitCost` مباشرة
 *                 items:
 *                   type: object
 *                   properties:
 *                     equipmentId:
 *                       type: string
 *                       description: "🔗 Mode 1 — من GET /api/equipment (يُغني عن name و unitCost)"
 *                       example: "64a2f1c3e21b4a0023456789"
 *                     name:
 *                       type: string
 *                       description: "✍️ Mode 2 — اسم المعدة (مطلوب لو مفيش equipmentId)"
 *                       example: "رافعة مستأجرة"
 *                     count:
 *                       type: integer
 *                       default: 1
 *                       example: 2
 *                     unit:
 *                       type: string
 *                       default: "وحدة"
 *                     unitCost:
 *                       type: number
 *                       description: "Mode 2: سعر الوحدة. Mode 1: يُحسب تلقائياً من dailyCost × مدة المشروع (override اختياري)"
 *                       example: 500
 *                     ownershipType:
 *                       type: string
 *                       enum: [OWNED, RENTED, BORROWED]
 *                       default: OWNED
 *               members:
 *                 type: array
 *                 description: Optional team members or VACANT slots
 *                 items:
 *                   type: object
 *                   properties:
 *                     user: { type: string, description: "User ObjectId (omit for VACANT slot)" }
 *                     role: { type: string, example: "مدير المشروع" }
 *                     estimatedCost: { type: number }
 *     responses:
 *       201:
 *         description: Project created (DRAFT or PLANNING based on skipActivation)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string, description: "Use this projectId in all next steps" }
 *                     status: { type: string, enum: [DRAFT, PLANNING] }
 *                     estimatedCost: { type: number, description: "Auto-calculated from materials + equipment + members" }
 *       400:
 *         description: Validation error — name / type / manager مطلوبين
 */

router.route("/")
  .get(auth, permission("VIEW_PROJECT"), projectService.get_projects)
  .post(auth, permission("CREATE_PROJECT"), projectService.create_project);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project details including members
 *   put:
 *     summary: Update project details
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               type: { type: string, description: "MongoDB ObjectId for project type" }
 *               manager: { type: string, description: "MongoDB ObjectId for manager" }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH] }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               department: { type: string, description: "MongoDB ObjectId for department" }
 *               client: { type: string, description: "MongoDB ObjectId for client" }
 *               budget: { type: number }
 *               description: { type: string }
 *               warehouseType: { type: string, enum: [SHARED, DEDICATED] }
 *               dedicatedWarehouse: { type: string, description: "MongoDB ObjectId for warehouse" }
 *               sourceWarehouse: { type: string, description: "MongoDB ObjectId for the Parent/Main Warehouse" }
 *               initialTransfers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string, description: "MongoDB ObjectId for material" }
 *                     quantity: { type: number }
 *                     fromWarehouse: { type: string, description: "MongoDB ObjectId for source warehouse" }
 *     responses:
 *       200:
 *         description: Project updated
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project deleted
 */
router.route("/:id")
  .get(auth, permission("VIEW_PROJECT"), projectService.get_project)
  .put(auth, permission("EDIT_PROJECT"), projectService.update_project)
  .delete(auth, permission("DELETE_PROJECT"), projectService.delete_project);

/**
 * @swagger
 * /projects/{id}/members/{memberId}/assign:
 *   post:
 *     summary: Assign a user to a project vacancy
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         description: Vacancy ID (ProjectMember ID)
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: MongoDB ObjectId for the user to assign
 *     responses:
 *       200:
 *         description: Member assigned successfully
 */
router.post(
  "/:id/members/:memberId/assign",
  auth,
  permission("EDIT_PROJECT"),
  projectService.assign_member
);

/**
 * @swagger
 * /projects/{id}/summary:
 *   get:
 *     summary: Get full project summary (for review screen)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full project data including phases, members, materials, equipment, documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project: { type: object }
 *                     phases: { type: array }
 *                     members: { type: array }
 *                     materials: { type: array }
 *                     equipment: { type: array }
 *                     documents: { type: array }
 *                     budget: { type: number }
 */
router.get(
  "/:id/summary",
  auth,
  permission("VIEW_PROJECT"),
  projectService.get_project_summary
);

/**
 * @swagger
 * /projects/{id}/activate:
 *   post:
 *     summary: "Step 6: Activate project — تفعيل المشروع وتنفيذ نقل المواد"
 *     description: |
 *       ## ما يحدث تلقائياً عند الاستدعاء:
 *
 *       ### 1. إنشاء المستودع المخصص (إن لزم)
 *       - إذا كان `warehouseType === "DEDICATED"` ولم يتم اختيار مستودع مسبقاً
 *       - يتم إنشاء مستودع جديد تلقائياً باسم المشروع ويُربط بـ `dedicatedWarehouse`
 *       - إذا تم اختيار مستودع موجود مسبقاً → يُستخدم مباشرةً بدون إنشاء
 *       - إذا كان `warehouseType === "SHARED"` → لا يُنشأ أي مستودع
 *
 *       ### 2. تنفيذ عمليات نقل المواد الأولية (initialTransfers)
 *       لكل عملية نقل:
 *       - ✅ يُخصم من المستودع المصدر (`fromWarehouse`)
 *       - ✅ يُضاف إلى مستودع المشروع (`dedicatedWarehouse`)
 *       - ✅ يُسجَّل في `MaterialTransaction` بنوع `TRANSFER`
 *       - ⚠️ إذا كانت الكمية غير متوفرة → يُرسَل إشعار للمدير بدلاً من الإلغاء (لا يتوقف الكود)
 *
 *       ### 3. تغيير حالة المشروع
 *       ```
 *       DRAFT → PLANNING
 *       ```
 *
 *       ### 4. فتح كل المراحل تلقائياً
 *       ```
 *       جميع phases → status: "IN_PROGRESS"
 *       ```
 *
 *       ---
 *       ## متى ترسل `initialTransfers` هنا بدلاً من الـ POST /api/projects؟
 *       - لو المستخدم غيّر بيانات المواد في Step 4 بعد إنشاء الـ Draft
 *       - الـ Body هنا هيــ **Override** ما تم حفظه في الـ Draft
 *       - لو لم ترسل Body → يستخدم الـ `initialTransfers` المحفوظة في الـ Draft مباشرةً
 *
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID (يجب أن يكون في حالة DRAFT)
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               initialTransfers:
 *                 type: array
 *                 description: "اختياري — Override للـ transfers المحفوظة في الـ Draft. اتركه فارغاً لاستخدام ما تم حفظه."
 *                 items:
 *                   type: object
 *                   required: [material, quantity, fromWarehouse]
 *                   properties:
 *                     material:
 *                       type: string
 *                       description: "Material ObjectId — GET /api/materials"
 *                       example: "69da15bf10cc497e60a12b12"
 *                     quantity:
 *                       type: number
 *                       description: "الكمية المراد نقلها"
 *                       example: 20
 *                     fromWarehouse:
 *                       type: string
 *                       description: "Source Warehouse ObjectId — GET /api/warehouses"
 *                       example: "69da15bf10cc497e60a12b99"
 *     responses:
 *       200:
 *         description: |
 *           تم التفعيل بنجاح. المشروع الآن في حالة PLANNING.
 *           راجع الـ Notifications لأي transfers فشلت بسبب نقص المخزون.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Project activated successfully and initial transfers processed." }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     status: { type: string, example: "PLANNING" }
 *                     dedicatedWarehouse: { type: string, description: "ID of the dedicated warehouse (auto-created or existing)" }
 *       400:
 *         description: "المشروع ليس في حالة DRAFT، أو لا يوجد مدير مشروع"
 *       404:
 *         description: "المشروع غير موجود"
 */
router.post(
  "/:id/activate",
  auth,
  permission("EDIT_PROJECT"),
  projectService.activate_project
);

/**
 * @swagger
 * /projects/{id}/phases/{phaseId}/status:
 *   patch:
 *     summary: Simplest way to open or close a project's phase
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: phaseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *                 description: Set to COMPLETED to close the phase, or IN_PROGRESS to open it.
 *     responses:
 *       200:
 *         description: Phase status updated successfully
 */
router.patch(
  "/:id/phases/:phaseId/status",
  auth,
  permission("EDIT_PROJECT"),
  projectService.update_phase_status
);

/**
 * @swagger
 * /projects/{id}/phases/{phaseId}:
 *   get:
 *     summary: Get specific phase details (Header info, budget, expenses, progress)
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: phaseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full phase details and computed statistics
 */
router.get(
  "/:id/phases/:phaseId",
  auth,
  permission("VIEW_PROJECT"),
  projectService.get_phase_details
);

export default router;
