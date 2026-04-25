import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";
import { uploadMultiple } from "../../middlewares/upload.js";
import * as ticketService from "./ticket.service.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: إدارة الطلبات والصيانة
 */

// ─── List & Create ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /tickets:
 *   get:
 *     summary: قائمة الطلبات مع ملخص الحالات وصفحات النتائج
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: project,  schema: { type: string }, description: "ObjectId المشروع" }
 *       - { in: query, name: type,     schema: { type: string, enum: [MAINTENANCE, SUPPORT, INSPECTION, OTHER] } }
 *       - { in: query, name: status,   schema: { type: string, enum: [NEW, UNDER_REVIEW, AWAITING_APPROVAL, APPROVED, IN_PROGRESS, COMPLETED, REJECTED] } }
 *       - { in: query, name: priority, schema: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] } }
 *       - { in: query, name: from,     schema: { type: string, format: date }, description: "تاريخ البداية" }
 *       - { in: query, name: to,       schema: { type: string, format: date }, description: "تاريخ النهاية" }
 *       - { in: query, name: search,   schema: { type: string }, description: "بحث برقم الطلب" }
 *       - { in: query, name: page,     schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,    schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: |
 *           يُرجع:
 *           - `summary`: عدد الطلبات لكل حالة (للبطاقات العلوية في الـ UI)
 *           - `pagination`: معلومات التصفح
 *           - `data`: قائمة الطلبات
 */
router.get("/", auth, ticketService.getTickets);

/**
 * @swagger
 * /tickets:
 *   post:
 *     summary: إنشاء طلب جديد (يدعم رفع ملفات متعددة)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, description]
 *             properties:
 *               type:         { type: string, enum: [MAINTENANCE, SUPPORT, INSPECTION, OTHER] }
 *               project:      { type: string, description: "ObjectId" }
 *               projectPhase: { type: string, description: "ObjectId" }
 *               equipment:    { type: string, description: "ObjectId" }
 *               description:  { type: string }
 *               reviewNotes:  { type: string }
 *               priority:     { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               targetDate:   { type: string, format: date }
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: "تم إنشاء الطلب — requestId يُولَّد تلقائياً (REQ-YYYY-NNN)"
 */
router.post("/", auth, uploadMultiple("files", 10), ticketService.createTicket);

// ─── Stats (Reports Page) ─────────────────────────────────────────────────────

/**
 * @swagger
 * /tickets/stats:
 *   get:
 *     summary: إحصائيات للـ Reports page (KPIs + charts data)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to,   schema: { type: string, format: date } }
 *     responses:
 *       200:
 *         description: |
 *           يُرجع:
 *           - `kpis`: متوسط الإنجاز، مرفوضة، قيد التنفيذ، مكتملة، الإجمالي
 *           - `byStatus`: توزيع حسب الحالة
 *           - `byType`: توزيع حسب النوع
 *           - `byProject`: إحصائيات المشاريع (الجدول)
 *           - `byTeam`: أداء الفريق
 */
router.get("/stats", auth, ticketService.getTicketStats);

// ─── Single Ticket ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /tickets/{id}:
 *   get:
 *     summary: تفاصيل طلب واحد (مع التاريخ والتعليقات والمرفقات)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: تفاصيل الطلب كاملة }
 */
router.get("/:id", auth, ticketService.getTicketById);

/**
 * @swagger
 * /tickets/{id}:
 *   patch:
 *     summary: تعديل بيانات الطلب
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:         { type: string }
 *               project:      { type: string }
 *               projectPhase: { type: string }
 *               equipment:    { type: string }
 *               description:  { type: string }
 *               reviewNotes:  { type: string }
 *               priority:     { type: string }
 *               targetDate:   { type: string, format: date }
 *               assignedTeam: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: تم التحديث }
 */
router.patch("/:id", auth, ticketService.updateTicket);

/**
 * @swagger
 * /tickets/{id}:
 *   delete:
 *     summary: حذف طلب
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: تم الحذف }
 */
router.delete("/:id", auth, permission("DELETE_PROJECT"), ticketService.deleteTicket);

// ─── Workflow ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /tickets/{id}/status:
 *   put:
 *     summary: تحديث حالة الطلب (workflow — يسجل تاريخ التغييرات)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
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
 *                 enum: [NEW, UNDER_REVIEW, AWAITING_APPROVAL, APPROVED, IN_PROGRESS, COMPLETED, REJECTED]
 *               assignedTeam:    { type: array, items: { type: string } }
 *               rejectionReason: { type: string }
 *               reviewNotes:     { type: string }
 *               notes:           { type: string, description: "ملاحظة في سجل التاريخ" }
 *     responses:
 *       200: { description: تم تحديث الحالة }
 */
router.put("/:id/status", auth, ticketService.updateTicketStatus);

// ─── Comments ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /tickets/{id}/comments:
 *   post:
 *     summary: إضافة تعليق على الطلب
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       201: { description: تم إضافة التعليق }
 */
router.post("/:id/comments", auth, ticketService.addComment);

// ─── Attachments ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /tickets/{id}/attachments:
 *   post:
 *     summary: رفع ملفات مرفقة على طلب موجود (Cloudinary)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201: { description: تم رفع الملفات }
 */
router.post("/:id/attachments", auth, uploadMultiple("files", 10), ticketService.uploadTicketAttachments);

/**
 * @swagger
 * /tickets/{id}/attachments/{attachmentId}:
 *   delete:
 *     summary: حذف مرفق من طلب
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id,           required: true, schema: { type: string } }
 *       - { in: path, name: attachmentId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: تم حذف المرفق }
 */
router.delete("/:id/attachments/:attachmentId", auth, ticketService.deleteTicketAttachment);

export default router;
