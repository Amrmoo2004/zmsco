import { Router } from "express";
import * as materialRequestService from "./material-request.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Material Requests
 *   description: Material Request Management
 */

/**
 * @swagger
 * /material-requests:
 *   get:
 *     summary: Get all material requests
 *     tags: [Material Requests]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, FULFILLED] }
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of material requests }
 *   post:
 *     summary: Create material request
 *     tags: [Material Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project
 *               - materials
 *             properties:
 *               project: { type: string }
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     material: { type: string }
 *                     quantity: { type: number }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Request created }
 */
router.get("/", auth, permission("VIEW_REPORTS"), materialRequestService.getAllRequests);
router.post("/", auth, permission("CREATE_PROJECT"), materialRequestService.createRequest);

/**
 * @swagger
 * /material-requests/{id}:
 *   get:
 *     summary: Get request by ID
 *     tags: [Material Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request details }
 *   put:
 *     summary: Update request
 *     tags: [Material Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request updated }
 *   delete:
 *     summary: Delete request
 *     tags: [Material Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request deleted }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), materialRequestService.getRequestById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), materialRequestService.updateRequest);
router.delete("/:id", auth, permission("DELETE_PROJECT"), materialRequestService.deleteRequest);

/**
 * @swagger
 * /material-requests/{id}/approve:
 *   patch:
 *     summary: Approve material request
 *     tags: [Material Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request approved }
 */
router.patch("/:id/approve", auth, permission("UPDATE_PROJECT"), materialRequestService.approveRequest);

/**
 * @swagger
 * /material-requests/{id}/reject:
 *   patch:
 *     summary: Reject material request
 *     tags: [Material Requests]
 *     parameters:
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
 *               reason: { type: string }
 *     responses:
 *       200: { description: Request rejected }
 */
router.patch("/:id/reject", auth, permission("UPDATE_PROJECT"), materialRequestService.rejectRequest);

/**
 * @swagger
 * /material-requests/{id}/fulfill:
 *   patch:
 *     summary: Mark request as fulfilled
 *     tags: [Material Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request fulfilled }
 */
router.patch("/:id/fulfill", auth, permission("UPDATE_PROJECT"), materialRequestService.fulfillRequest);

export default router;
