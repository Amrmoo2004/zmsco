import { Router } from "express";
import * as equipmentService from "./equipment.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Equipment
 *   description: Equipment Fleet, Maintenance Logs & Project Assignments
 *
 * /equipment:
 *   get:
 *     summary: Get all active equipment
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of equipment }
 *   post:
 *     summary: Add new equipment to fleet
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string }
 *               type: { type: string }
 *               brand: { type: string }
 *               capacity: { type: string }
 *               condition: { type: string, enum: [EXCELLENT, GOOD, FAIR, POOR, UNDER_MAINTENANCE] }
 *               purchaseDate: { type: string, format: date }
 *               dailyCost: { type: number }
 *     responses:
 *       201: { description: Equipment created }
 *
 * /equipment/{id}:
 *   get:
 *     summary: Get equipment by ID
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Equipment details }
 *   put:
 *     summary: Update equipment
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Equipment updated }
 *   delete:
 *     summary: Deactivate equipment
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Equipment deactivated }
 *
 * /equipment/{id}/maintenance:
 *   get:
 *     summary: Get maintenance logs for an equipment item
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Maintenance log list }
 *   post:
 *     summary: Add a maintenance log entry
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date: { type: string, format: date }
 *               type: { type: string, enum: [INSPECTION, PREVENTIVE, CORRECTIVE] }
 *               cost: { type: number }
 *               description: { type: string }
 *     responses:
 *       201: { description: Maintenance log added }
 *
 * /equipment/assignments:
 *   get:
 *     summary: Get equipment assignments (filter by project or equipment)
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of assignments }
 *   post:
 *     summary: Assign equipment to a project/phase
 *     tags: [Equipment]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [equipment, project, startDate]
 *             properties:
 *               equipment: { type: string }
 *               project: { type: string }
 *               phase: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               allocationPercentage: { type: number }
 *     responses:
 *       201: { description: Equipment assigned }
 */

// Assignments
router.get("/assignments", auth, equipmentService.getAssignments);
router.post("/assignments", auth, permission("UPDATE_PROJECT"), equipmentService.assignEquipment);
router.put("/assignments/:assignmentId", auth, permission("UPDATE_PROJECT"), equipmentService.updateAssignment);

// Equipment Fleet Base
router.get("/", auth, equipmentService.getAllEquipment);
router.post("/", auth, permission("CREATE_PROJECT"), equipmentService.createEquipment);




// Maintenance Logs (Put these before pure /:id just to be safe)
router.get("/:id/maintenance", auth, equipmentService.getMaintenanceLogs);
router.post("/:id/maintenance", auth, permission("UPDATE_PROJECT"), equipmentService.addMaintenanceLog);

// Equipment Fleet CRUD by ID
router.get("/:id", auth, equipmentService.getEquipmentById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), equipmentService.updateEquipment);
router.delete("/:id", auth, permission("DELETE_PROJECT"), equipmentService.deleteEquipment);

export default router;
