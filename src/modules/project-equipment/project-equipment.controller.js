import { Router } from "express";
import * as projectEquipmentService from "./project-equipment.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Equipment
 *   description: Project Equipment Management
 */

/**
 * @swagger
 * /projects/{projectId}/equipment:
 *   get:
 *     summary: Get project equipment
 *     tags: [Project Equipment]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of equipment }
 *   post:
 *     summary: Add equipment to project
 *     tags: [Project Equipment]
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
 *               - quantity
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               quantity: { type: number }
 *               status: { type: string }
 *     responses:
 *       201: { description: Equipment added }
 */
router.get("/:projectId/equipment", auth, permission("VIEW_REPORTS"), projectEquipmentService.getProjectEquipment);
router.post("/:projectId/equipment", auth, permission("UPDATE_PROJECT"), projectEquipmentService.addProjectEquipment);

/**
 * @swagger
 * /projects/{projectId}/equipment/{id}:
 *   put:
 *     summary: Update equipment
 *     tags: [Project Equipment]
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
 *       200: { description: Equipment updated }
 *   delete:
 *     summary: Remove equipment from project
 *     tags: [Project Equipment]
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
 *       200: { description: Equipment removed }
 */
router.put("/:projectId/equipment/:id", auth, permission("UPDATE_PROJECT"), projectEquipmentService.updateProjectEquipment);
router.delete("/:projectId/equipment/:id", auth, permission("UPDATE_PROJECT"), projectEquipmentService.removeProjectEquipment);

export default router;
