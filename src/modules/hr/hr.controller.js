import { Router } from "express";
import * as hrService from "./hr.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: HR
 *   description: Human Resources - Work Logs and HR Requests
 *
 * /hr/work-logs:
 *   get:
 *     summary: Get work logs (filter by project/user/phase query params)
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: project, schema: { type: string } }
 *       - { in: query, name: user, schema: { type: string } }
 *       - { in: query, name: phase, schema: { type: string } }
 *     responses:
 *       200: { description: List of work logs }
 *   post:
 *     summary: Log hours worked (timesheet)
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project, date, hoursLogged]
 *             properties:
 *               project: { type: string }
 *               phase: { type: string }
 *               date: { type: string, format: date }
 *               hoursLogged: { type: number, minimum: 0, maximum: 24 }
 *               description: { type: string }
 *     responses:
 *       201: { description: Work log created }
 *
 * /hr/work-logs/{id}:
 *   put:
 *     summary: Update own work log
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Work log updated }
 *   delete:
 *     summary: Delete own work log
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Work log deleted }
 *
 * /hr/requests:
 *   get:
 *     summary: Get HR requests (own or all with ?all=true)
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: all, schema: { type: boolean }, description: "If true, returns all users' requests (admin)" }
 *     responses:
 *       200: { description: List of HR requests }
 *   post:
 *     summary: Submit an HR request (leave, overtime, etc.)
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestType, reason]
 *             properties:
 *               requestType: { type: string, enum: [LEAVE, REPLACEMENT, OVERTIME, ADVANCE] }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               reason: { type: string }
 *               relatedProject: { type: string }
 *     responses:
 *       201: { description: HR request submitted }
 *
 * /hr/requests/{id}/process:
 *   put:
 *     summary: Approve or reject an HR request
 *     tags: [HR]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               rejectionReason: { type: string }
 *     responses:
 *       200: { description: HR request processed }
 */

// Work Logs
router.get("/work-logs", auth, hrService.getWorkLogs);
router.post("/work-logs", auth, hrService.createWorkLog);
router.put("/work-logs/:id", auth, hrService.updateWorkLog);
router.delete("/work-logs/:id", auth, hrService.deleteWorkLog);

// HR Requests
router.get("/requests", auth, hrService.getHrRequests);
router.post("/requests", auth, hrService.createHrRequest);
router.put("/requests/:id/process", auth, permission("UPDATE_PROJECT"), hrService.processHrRequest);

export default router;
