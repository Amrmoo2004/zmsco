import { Router } from "express";
import * as auditLogService from "./auditLog.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Get all audit logs with filters and pagination
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: user, schema: { type: string }, description: Filter by user ID }
 *       - { in: query, name: entity, schema: { type: string }, description: "Filter by entity name (e.g. Project, User)" }
 *       - { in: query, name: action, schema: { type: string, enum: [CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE, REJECT, UPLOAD, DOWNLOAD, ASSIGN, REVOKE, EXPORT] } }
 *       - { in: query, name: status, schema: { type: string, enum: [SUCCESS, FAILED] } }
 *       - { in: query, name: from, schema: { type: string, format: date }, description: Start date filter }
 *       - { in: query, name: to, schema: { type: string, format: date }, description: End date filter }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
 *
 * /audit-logs/summary:
 *   get:
 *     summary: Get audit log summary statistics (today count, by action, by entity, recent users)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Audit statistics dashboard
 *
 * /audit-logs/{id}:
 *   get:
 *     summary: Get a single audit log entry by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Audit log details }
 *       404: { description: Audit log not found }
 */

router.get("/summary", auth, permission("MANAGE_SETTINGS"), auditLogService.getAuditSummary);
router.get("/", auth, permission("MANAGE_SETTINGS"), auditLogService.getAuditLogs);
router.get("/:id", auth, permission("MANAGE_SETTINGS"), auditLogService.getAuditLogById);

export default router;
