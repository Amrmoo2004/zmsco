import { Router } from "express";
import * as departmentService from "./department.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: System Settings - Departments, Job Titles, Workflows, Project Types, Roles & Configurations
 *
 * /departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of departments
 *   post:
 *     summary: Create a new department
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn, code]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               code: { type: string }
 *               description: { type: string }
 *               manager: { type: string, description: "User ObjectId" }
 *     responses:
 *       201:
 *         description: Department created
 *
 * /departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department details
 *   put:
 *     summary: Update department
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
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
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               code: { type: string }
 *               description: { type: string }
 *               manager: { type: string, description: "MongoDB ObjectId" }
 *     responses:
 *       200:
 *         description: Department updated
 *   delete:
 *     summary: Delete department
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department deleted
 */

router.get("/", auth, departmentService.getAllDepartments);
router.post("/", auth, permission("MANAGE_SETTINGS"), departmentService.createDepartment);
router.get("/:id", auth, departmentService.getDepartmentById);
router.put("/:id", auth, permission("MANAGE_SETTINGS"), departmentService.updateDepartment);
router.delete("/:id", auth, permission("MANAGE_SETTINGS"), departmentService.deleteDepartment);

export default router;
