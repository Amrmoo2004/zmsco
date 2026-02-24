import { Router } from "express";
import * as ticketService from "./ticket.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Maintenance and Support Ticket Management
 *
 * /tickets:
 *   get:
 *     summary: Get all tickets (filter by project, type, status, priority)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: project, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string, enum: [MAINTENANCE, SUPPORT, INSPECTION, OTHER] } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: priority, schema: { type: string } }
 *     responses:
 *       200: { description: List of tickets }
 *   post:
 *     summary: Create a new ticket
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, description]
 *             properties:
 *               type: { type: string, enum: [MAINTENANCE, SUPPORT, INSPECTION, OTHER] }
 *               project: { type: string }
 *               equipment: { type: string }
 *               description: { type: string }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *               targetDate: { type: string, format: date }
 *     responses:
 *       201: { description: Ticket created with auto-generated ID (REQ-YYYY-NNN) }
 *
 * /tickets/{id}:
 *   get:
 *     summary: Get ticket by ID (includes history and comments)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Ticket details }
 *   delete:
 *     summary: Delete a ticket
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Ticket deleted }
 *
 * /tickets/{id}/status:
 *   put:
 *     summary: Update ticket status (moves through workflow, records history)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [NEW, UNDER_REVIEW, AWAITING_APPROVAL, IN_PROGRESS, COMPLETED, REJECTED]
 *               assignedTeam: { type: array, items: { type: string } }
 *               rejectionReason: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200: { description: Ticket status updated }
 *
 * /tickets/{id}/comments:
 *   post:
 *     summary: Add a comment to a ticket
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *     responses:
 *       201: { description: Comment added }
 */

router.get("/", auth, ticketService.getTickets);
router.post("/", auth, ticketService.createTicket);
router.get("/:id", auth, ticketService.getTicketById);
router.delete("/:id", auth, permission("DELETE_PROJECT"), ticketService.deleteTicket);
router.put("/:id/status", auth, ticketService.updateTicketStatus);
router.post("/:id/comments", auth, ticketService.addComment);

export default router;
