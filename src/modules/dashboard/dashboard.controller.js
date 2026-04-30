import express from "express";
import * as dashboardService from "./dashboard.service.js";
import { auth } from "../../middlewares/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard analytics and stats
 */

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: إحصائيات لوحة التحكم العامة (Admin)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: إحصائيات المشاريع والميزانية والموظفين والمخزون
 */
router.get("/stats", auth, dashboardService.getDashboardStats);

/**
 * @swagger
 * /dashboard/my:
 *   get:
 *     summary: لوحة التحكم الشخصية للمستخدم الحالي
 *     description: |
 *       يُرجع بيانات مخصصة للمستخدم المسجّل:
 *
 *       ### `stats` — البطاقات العلوية (4 بطاقات في UI)
 *       | الحقل | الوصف | البطاقة في UI |
 *       |---|---|---|
 *       | `delayed` | عدد المهام المتأخرة | 🔴 مهام متأخرة |
 *       | `pendingApproval` | مهام حالتها PENDING | 🟡 بانتظار موافقة |
 *       | `inProgress` | مهام حالتها IN_PROGRESS | 🔵 مهام قيد التنفيذ |
 *       | `myProjectsCount` | إجمالي مشاريعه | 🟢 مشاريعي |
 *
 *       ### `tasks[]` — قائمة المهام (مرتبة: متأخرة أولاً)
 *       كل مهمة تحتوي: `name, status, priority, dueDate, isDelayed, projectId, projectName, phaseId, phaseName`
 *
 *       ### `projects[]` — مشاريعي
 *       كل مشروع يحتوي: `name, status, progress, myRole, currentPhase, phases[], totalTasks, activeTasks`
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: بيانات لوحة التحكم الشخصية
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         delayed:         { type: integer, example: 1 }
 *                         pendingApproval: { type: integer, example: 1 }
 *                         inProgress:      { type: integer, example: 2 }
 *                         myProjectsCount: { type: integer, example: 3 }
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:         { type: string }
 *                           name:        { type: string }
 *                           status:      { type: string, enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED] }
 *                           priority:    { type: string, enum: [LOW, MEDIUM, HIGH] }
 *                           dueDate:     { type: string, format: date }
 *                           isDelayed:   { type: boolean }
 *                           projectId:   { type: string }
 *                           projectName: { type: string }
 *                           phaseId:     { type: string }
 *                           phaseName:   { type: string }
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:      { type: string }
 *                           name:     { type: string }
 *                           status:   { type: string }
 *                           progress: { type: integer, example: 65 }
 *                           myRole:   { type: string, example: "مهندس تنفيذ" }
 *                           currentPhase:
 *                             type: object
 *                             properties:
 *                               _id:    { type: string }
 *                               name:   { type: string }
 *                               status: { type: string }
 *                               order:  { type: integer }
 *                           phases:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 _id:    { type: string }
 *                                 name:   { type: string }
 *                                 status: { type: string }
 *                                 order:  { type: integer }
 */
router.get("/my", auth, dashboardService.getMyDashboard);

export default router;
