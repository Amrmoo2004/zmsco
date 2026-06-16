import { Router } from 'express';
import { auth } from '../../middlewares/auth.js';
import * as notificationService from './notification.service.js';

const router = Router();

// ============================================================
// SWAGGER SCHEMAS (reusable components)
// ============================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         user:
 *           type: string
 *           description: ID of the recipient user
 *           example: "64f1a2b3c4d5e6f7a8b9c0d2"
 *         title:
 *           type: string
 *           example: "✅ مرحلة اكتملت"
 *         body:
 *           type: string
 *           example: "تم إكمال مرحلة التخطيط في مشروع شبكة الصرف الشمالية"
 *         type:
 *           type: string
 *           enum: [INFO, WARNING, SUCCESS, ERROR]
 *           description: |
 *             Notification severity level:
 *             - **INFO** – General information (task assigned, document uploaded, new request, etc.)
 *             - **SUCCESS** – Positive outcome (phase completed, project completed, material approved, HR approved)
 *             - **WARNING** – Attention required (member removed, phase delayed, low stock)
 *             - **ERROR** – Failure or rejection (material request rejected, HR request rejected)
 *           example: "SUCCESS"
 *         isRead:
 *           type: boolean
 *           example: false
 *         data:
 *           type: object
 *           description: Extra contextual payload (IDs for deep-linking)
 *           example: { "projectId": "64f...", "phaseId": "64f..." }
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2025-06-16T07:00:00.000Z"
 *
 *     NotificationListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             notifications:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *             unreadCount:
 *               type: integer
 *               example: 3
 */

// ============================================================
// TAGS
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: |
 *       ## Real-time Notification Management
 *
 *       ### Overview
 *       All notifications are persisted in MongoDB and delivered in real-time via **Socket.IO**.
 *       Each user receives notifications in their own socket room (`userId`).
 *
 *       ### Notification Types
 *       | Type | Color | Usage |
 *       |------|-------|-------|
 *       | `INFO` | Blue | General info — task assigned, document uploaded, new request |
 *       | `SUCCESS` | Green | Positive outcome — phase/project completed, material approved |
 *       | `WARNING` | Yellow | Attention needed — member removed, phase delayed, low stock |
 *       | `ERROR` | Red | Rejected — material request, HR request |
 *
 *       ---
 *       ## System-Generated Notifications Catalogue
 *
 *       The following notifications are **automatically emitted** by the system when business events occur.
 *       They cannot be triggered directly via the API — they fire as side effects of other endpoints.
 *
 *       ---
 *       ### 👤 Project Members
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | Member added to project | `INFO` | The newly added user | `👤 تم تعيينك في مشروع` |
 *       | Member role changed | `INFO` | The member | `🔄 تم تغيير دورك في المشروع` |
 *       | Member removed from project | `WARNING` | The removed user | `🚪 تم إزالتك من مشروع` |
 *
 *       **Data payload** → `{ projectId, role? }`
 *       **Triggered by** → `POST/PATCH/DELETE /api/projects/:projectId/members/:id`
 *
 *       ---
 *       ### 📋 Tasks
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | Task created and assigned | `INFO` | Assigned user | `تم تعيينك في مهمة جديدة` |
 *       | Task reassigned (new assignee) | `INFO` | New assigned user | `تم تعيينك في مهمة` |
 *       | Task attachment uploaded | `INFO` | Task assignee + project manager | `📎 مرفق جديد على مهمة` |
 *
 *       **Data payload** → `{ taskId, phaseId, projectId, attachmentId? }`
 *       **Triggered by** → `POST /api/projects/:projectId/phases/:phaseId/tasks` + `PUT .../tasks/:taskId` + `POST .../tasks/:taskId/attachments`
 *
 *       ---
 *       ### 🔄 Project Phases
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | Phase status → COMPLETED | `SUCCESS` | All project members | `✅ مرحلة "X" اكتملت` |
 *       | Phase status → DELAYED | `WARNING` | All project members | `⚠️ مرحلة "X" متأخرة` |
 *       | Phase auto-completed (all tasks/attachments/approvals done) | `SUCCESS` | All project members | `✅ مرحلة "X" اكتملت` |
 *
 *       **Data payload** → `{ projectId, phaseId }`
 *       **Triggered by** → `PATCH /api/projects/:projectId/phases/:phaseId` + task/attachment/approval completion
 *
 *       ---
 *       ### 🎉 Projects
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | All phases completed → project done | `SUCCESS` | Project manager | `🎉 اكتمل المشروع بنجاح!` |
 *       | Phase completed, next phase opened | `INFO` | Project manager | `✅ اكتملت مرحلة: X` |
 *       | Phase approval → APPROVED | `SUCCESS` | Project manager | `✅ موافقة جديدة على مرحلة` |
 *       | Phase approval → REJECTED | `WARNING` | Project manager | `❌ رفض موافقة على مرحلة` |
 *       | Inventory deficit during project activation | `WARNING` | Project manager | `عجز في المخزون لنقل المواد الأولية` |
 *
 *       **Data payload** → `{ projectId, phaseId?, nextPhaseId?, type: "PROJECT_COMPLETED"|"PHASE_COMPLETED"|"PHASE_APPROVAL" }`
 *       **Triggered by** → `POST /api/projects/:projectId/phases/:phaseId/complete` + `POST /api/projects/:id/activate`
 *
 *       ---
 *       ### 📄 Project Documents
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | Document uploaded to project | `INFO` | All project members (except uploader) + manager | `📎 مرفق جديد رُفِع` |
 *
 *       **Data payload** → `{ projectId, documentId }`
 *       **Triggered by** → `POST /api/projects/:projectId/documents`
 *
 *       ---
 *       ### 📦 Material Requests
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | New material request created | `INFO` | Project manager | `📋 طلب صرف مواد جديد` |
 *       | Request approved (direct, no workflow) | `SUCCESS` | Requester | `✅ طلب المواد تم قبوله` |
 *       | Request fully approved (workflow complete) | `SUCCESS` | Requester | `✅ طلب المواد اعتُمد بالكامل` |
 *       | Request rejected | `ERROR` | Requester | `❌ طلب المواد تم رفضه` |
 *       | Request fulfilled (materials issued) | `SUCCESS` | Requester | `📦 تم صرف المواد` |
 *       | Low stock alert during fulfillment | `WARNING` | All managers | `📉 مخزون منخفض: {materialName}` |
 *
 *       **Data payload** → `{ requestId, projectId, materialId?, currentQuantity?, minStock? }`
 *       **Triggered by** → `POST /api/material-requests` + `PATCH .../approve` + `PATCH .../reject` + `PATCH .../fulfill`
 *
 *       ---
 *       ### 🧑‍💼 HR Requests
 *       | Event | Type | Recipient | Title |
 *       |-------|------|-----------|-------|
 *       | New HR request submitted (leave / replacement / overtime / advance) | `INFO` | All admins + project manager | `📋 طلب {type} جديد` |
 *       | HR request approved | `SUCCESS` | Requester | `✅ تمت الموافقة على طلب {type}` |
 *       | HR request rejected | `ERROR` | Requester | `❌ تم رفض طلب {type}` |
 *
 *       **HR Request Types** → `LEAVE` (إجازة) | `REPLACEMENT` (بديل) | `OVERTIME` (عمل إضافي) | `ADVANCE` (سلفة)
 *
 *       **Data payload** → `{ requestId, requestType, projectId? }`
 *       **Triggered by** → `POST /api/hr/requests` + `PATCH /api/hr/requests/:id/process`
 *
 *       ---
 *       ### 🔌 Socket.IO Real-time Events (non-persisted)
 *       The following events are emitted via Socket.IO **without being saved** to the database.
 *       They are intended for live UI updates only.
 *
 *       | Event | Channel | Payload |
 *       |-------|---------|---------|
 *       | `notification:approval_pending` | managers room | `{ requestId, requestNumber, projectName, requestedBy, materialsCount, totalCost }` |
 *       | `approval:approved` | project room | `{ requestId, projectId, approvedBy, timestamp }` |
 *       | `approval:rejected` | project room | `{ requestId, reason, rejectedBy, timestamp }` |
 *       | `inventory:low_stock` | managers room | `{ materialId, materialName, currentQuantity, minStock }` |
 *       | `inventory:updated` | broadcast | `{ materialId, materialName, newQuantity, deducted, projectId }` |
 *       | `phase:updated` | project room | `{ type, phaseId, phaseName, projectId, status, prevStatus }` |
 *       | `notification:phase_completed` | project room | `{ phaseId, phaseName, projectId, completedAt }` |
 *       | `notification:project_at_risk` | project room | `{ phaseId, phaseName, projectId }` |
 *       | `attachment:added` | project room | `{ documentId, documentName, fileUrl, uploadedBy, projectId }` |
 *       | `resource:assigned` | project room | `{ type: MEMBER_ADDED\|MEMBER_REMOVED\|ROLE_UPDATED, userId, role?, projectId }` |
 *       | `system:error` | managers room | `{ message, ...data, timestamp }` |
 *       | `system:warning` | managers room | `{ message, ...data, timestamp }` |
 */

// ============================================================
// REST ENDPOINTS
// ============================================================

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get current user's notifications
 *     description: |
 *       Returns the **last 50 notifications** for the authenticated user, sorted newest-first.
 *       Also returns the total count of unread notifications.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *             example:
 *               success: true
 *               data:
 *                 notifications:
 *                   - _id: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                     title: "✅ مرحلة اكتملت"
 *                     body: "تم الانتهاء من مرحلة التخطيط في مشروع شبكة الصرف"
 *                     type: "SUCCESS"
 *                     isRead: false
 *                     data:
 *                       projectId: "64f1a2b3c4d5e6f7a8b9c0a1"
 *                       phaseId: "64f1a2b3c4d5e6f7a8b9c0a2"
 *                     createdAt: "2025-06-16T07:00:00.000Z"
 *                   - _id: "64f1a2b3c4d5e6f7a8b9c0d2"
 *                     title: "📎 مرفق جديد على مهمة"
 *                     body: "تم رفع مرفق \"report.pdf\" على مهمة \"مراجعة التصميم\" في مرحلة \"التنفيذ\" بمشروع \"شبكة الصرف الشمالية\""
 *                     type: "INFO"
 *                     isRead: false
 *                     data:
 *                       projectId: "64f1a2b3c4d5e6f7a8b9c0a1"
 *                       phaseId: "64f1a2b3c4d5e6f7a8b9c0a2"
 *                       taskId: "64f1a2b3c4d5e6f7a8b9c0a3"
 *                       attachmentId: "64f1a2b3c4d5e6f7a8b9c0a4"
 *                     createdAt: "2025-06-16T06:45:00.000Z"
 *                   - _id: "64f1a2b3c4d5e6f7a8b9c0d3"
 *                     title: "تم تعيينك في مهمة جديدة"
 *                     body: "تم إسناد مهمة \"مراجعة التصميم\" إليك في مرحلة \"التنفيذ\""
 *                     type: "INFO"
 *                     isRead: true
 *                     data:
 *                       projectId: "64f1a2b3c4d5e6f7a8b9c0a1"
 *                       phaseId: "64f1a2b3c4d5e6f7a8b9c0a2"
 *                       taskId: "64f1a2b3c4d5e6f7a8b9c0a3"
 *                     createdAt: "2025-06-15T10:30:00.000Z"
 *                   - _id: "64f1a2b3c4d5e6f7a8b9c0d4"
 *                     title: "📋 طلب صرف مواد جديد"
 *                     body: "تم إنشاء طلب صرف مواد جديد (REQ-001) في مشروع X"
 *                     type: "INFO"
 *                     isRead: true
 *                     data:
 *                       requestId: "64f1a2b3c4d5e6f7a8b9c0b1"
 *                       projectId: "64f1a2b3c4d5e6f7a8b9c0a1"
 *                     createdAt: "2025-06-15T08:00:00.000Z"
 *                 unreadCount: 2
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/', auth, notificationService.getUserNotifications);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Marks **all** unread notifications for the authenticated user as read in one operation.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All notifications marked as read"
 *       401:
 *         description: Unauthorized
 */
router.patch('/read-all', auth, notificationService.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     description: Marks one specific notification as read. The notification must belong to the authenticated user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the notification
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Notification not found or does not belong to this user
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/read', auth, notificationService.markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     description: Permanently deletes a notification. The notification must belong to the authenticated user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the notification to delete
 *         example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification deleted"
 *       404:
 *         description: Notification not found or does not belong to this user
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', auth, notificationService.deleteNotification);

export default router;
