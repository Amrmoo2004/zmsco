import { Router } from "express";
import * as projectPhaseService from "./project-phase.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Phases
 *   description: Project Phase Management
 */

/**
 * @swagger
 * /projects/{projectId}/phases:
 *   get:
 *     summary: Get project phases
 *     tags: [Project Phases]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of phases }
 *   post:
 *     summary: Create project phase
 *     tags: [Project Phases]
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
 *             required:
 *               - name
 *               - startDate
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               status: { type: string }
 *     responses:
 *       201: { description: Phase created }
 */
router.get("/:projectId/phases", auth, permission("VIEW_REPORTS"), projectPhaseService.getProjectPhases);
router.post("/:projectId/phases", auth, permission("UPDATE_PROJECT"), projectPhaseService.createProjectPhase);

/**
 * @swagger
 * /projects/{projectId}/phases/{id}:
 *   put:
 *     summary: Update project phase
 *     tags: [Project Phases]
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
 *       200: { description: Phase updated }
 *   delete:
 *     summary: Delete project phase
 *     tags: [Project Phases]
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
 *       200: { description: Phase deleted }
 */
router.put("/:projectId/phases/:id", auth, permission("EDIT_PROJECT"), projectPhaseService.updateProjectPhase);
router.delete("/:projectId/phases/:id", auth, permission("EDIT_PROJECT"), projectPhaseService.deleteProjectPhase);

/**
 * @swagger
 * /projects/{projectId}/phases/{id}/permits:
 *   get:
 *     summary: Get phase permits with summary (Step 5 UI)
 *     description: >
 *       يجيب التصاريح المطلوبة للمرحلة مع ملخص يوضح عدد المكتملة من الإلزامية.
 *       مثال للـ label: "تم إكمال 2 من أصل 4 تصاريح إلزامية"
 *     tags: [Project Phases]
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
 *       200:
 *         description: Permits list with summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     permits:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           name: { type: string, example: "رخصة بناء" }
 *                           issuingAuthority: { type: string, example: "إدارة التخطيط العمراني" }
 *                           authorityType: { type: string, example: "الجهة التنظيمية" }
 *                           permitNumber: { type: string, example: "BP-2026-1547" }
 *                           expiryDate: { type: string, format: date }
 *                           reviewStatus: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *                           isMandatory: { type: boolean }
 *                           isCompleted: { type: boolean }
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total: { type: number }
 *                         totalMandatory: { type: number }
 *                         completedMandatory: { type: number }
 *                         allMandatoryDone: { type: boolean }
 *                         label: { type: string, example: "تم إكمال 2 من أصل 4 تصاريح إلزامية" }
 */
router.get("/:projectId/phases/:id/permits", auth, permission("VIEW_REPORTS"), projectPhaseService.getPhasePermits);

/**
 * @swagger
 * /projects/{projectId}/phases/{id}/permits/{permitId}:
 *   patch:
 *     summary: Update a single permit (Step 5 — إضافة/تعديل تصريح)
 *     description: >
 *       يحدّث تصريح واحد داخل المرحلة برقم التصريح وتاريخ انتهائه.
 *       يعيّن reviewStatus تلقائياً: APPROVED إذا فيه permitNumber، PENDING إذا فارغ.
 *     tags: [Project Phases]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Phase ID
 *       - in: path
 *         name: permitId
 *         required: true
 *         schema: { type: string }
 *         description: Permit subdocument _id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permitNumber:
 *                 type: string
 *                 example: "BP-2026-1547"
 *                 description: رقم التصريح (معرف التصريح)
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-31"
 *                 description: تاريخ انتهاء صلاحية التصريح
 *               attachmentId:
 *                 type: string
 *                 description: ID of the uploaded permit file
 *               reviewStatus:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *                 description: يُعيَّن تلقائياً إذا لم يُرسَل
 *     responses:
 *       200:
 *         description: Permit updated successfully
 *       404:
 *         description: Phase or permit not found
 */
router.patch("/:projectId/phases/:id/permits/:permitId", auth, permission("EDIT_PROJECT"), projectPhaseService.updatePermit);

/**
 * @swagger
 * /projects/{projectId}/phases/{id}/permits:
 *   post:
 *     summary: Add a new permit to a phase (بعيداً عن البلوبرينت)
 *     description: يضيف تصريح جديد مباشرةً على المرحلة بدون الحاجة للبلوبرينت
 *     tags: [Project Phases]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Phase ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "رخصة بناء"
 *               issuingAuthority:
 *                 type: string
 *                 example: "إدارة التخطيط العمراني"
 *               authorityType:
 *                 type: string
 *                 example: "الجهة التنظيمية"
 *               permitNumber:
 *                 type: string
 *                 example: "BP-2026-1547"
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-31"
 *               isMandatory:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Permit added successfully
 *       400:
 *         description: اسم التصريح مطلوب
 */
router.post("/:projectId/phases/:id/permits", auth, permission("EDIT_PROJECT"), projectPhaseService.addPermit);

/**
 * @swagger
 * /projects/{projectId}/phases/{id}/permits/{permitId}:
 *   delete:
 *     summary: Delete a permit from a phase
 *     tags: [Project Phases]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Phase ID
 *       - in: path
 *         name: permitId
 *         required: true
 *         schema: { type: string }
 *         description: Permit subdocument _id
 *     responses:
 *       200:
 *         description: Permit deleted successfully
 *       404:
 *         description: Phase or permit not found
 */
router.delete("/:projectId/phases/:id/permits/:permitId", auth, permission("EDIT_PROJECT"), projectPhaseService.deletePermit);

export default router;
