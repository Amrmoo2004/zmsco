import { Router } from "express";
import * as closureService from "./projectClosure.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router({ mergeParams: true });

/**
 * @swagger
 * tags:
 *   name: Project Closure
 *   description: إغلاق المشروع — Checklists, المستخلص النهائي, الموافقات, الشهادة, التقارير, الأرشفة
 *
 * /projects/{projectId}/closure:
 *   post:
 *     summary: بدء عملية إغلاق المشروع (ينشئ checklist + approvals + المستخلص النهائي)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       201: { description: تم بدء عملية الإغلاق }
 *   get:
 *     summary: بيانات إغلاق المشروع (ملخص + Checklist + حسابات جاهزة)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: بيانات الإغلاق مع بيانات المشروع والحسابات }
 *
 * /projects/{projectId}/closure/checklist/{itemId}:
 *   put:
 *     summary: تأشير بند في قائمة التحقق كمكتمل
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string } }
 *       - { in: path, name: itemId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: تم التحقق من البند }
 *
 * /projects/{projectId}/closure/approve:
 *   put:
 *     summary: الموافقة أو رفض إغلاق المشروع (يسجل في سجل التدقيق)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               notes: { type: string }
 *     responses:
 *       200: { description: تم تسجيل الموافقة/الرفض }
 *
 * /projects/{projectId}/closure/final-extract:
 *   get:
 *     summary: المستخلص النهائي — استهلاك المواد + تكلفة العمالة + المعدات + مصروفات أخرى
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: بيانات المستخلص المالي النهائي مع الحسابات }
 *
 * /projects/{projectId}/closure/final-extract/approve:
 *   put:
 *     summary: اعتماد المستخلص النهائي
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: تم اعتماد المستخلص }
 *
 * /projects/{projectId}/closure/certificate:
 *   post:
 *     summary: إصدار شهادة إتمام المشروع (CERT-YYYY-NNN) مع الإنجازات والتوقيعات
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signatories:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     role: { type: string }
 *                     roleEn: { type: string }
 *     responses:
 *       201: { description: تم إصدار الشهادة }
 *
 * /projects/{projectId}/closure/reports:
 *   get:
 *     summary: التقارير النهائية — مالية + موارد + أداء (9 تقارير)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: قائمة التقارير مصنفة مع ملخص }
 *
 * /projects/{projectId}/closure/archive:
 *   post:
 *     summary: أرشفة المشروع (نقله لحالة ARCHIVED — للقراءة فقط)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: تم أرشفة المشروع }
 *
 * /projects/{projectId}/closure/archived:
 *   get:
 *     summary: بيانات المشروع المؤرشف (4 تابات — نظرة عامة + جدول زمني + مستندات + سجل تدقيق)
 *     tags: [Project Closure]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: projectId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: بيانات المشروع المؤرشف الكاملة }
 */

// Initiate / Get closure
router.post("/", auth, permission("UPDATE_PROJECT"), closureService.initiateClosure);
router.get("/", auth, closureService.getClosure);

// Checklist
router.put("/checklist/:itemId", auth, closureService.updateChecklistItem);

// Final Extract (المستخلص النهائي)
router.get("/final-extract", auth, closureService.getFinalExtract);
router.put("/final-extract/approve", auth, permission("UPDATE_PROJECT"), closureService.approveFinalExtract);

// Approvals
router.put("/approve", auth, closureService.approveClosure);

// Certificate
router.post("/certificate", auth, permission("UPDATE_PROJECT"), closureService.generateCertificate);

// Final Reports (التقارير النهائية)
router.get("/reports", auth, closureService.getFinalReports);

// Archive
router.post("/archive", auth, permission("UPDATE_PROJECT"), closureService.archiveProject);
router.get("/archived", auth, closureService.getArchivedProject);

export default router;
