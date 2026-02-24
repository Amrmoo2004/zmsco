import { Router } from "express";
import * as departmentService from "./department.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: Department Management APIs
 *
 * /departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Departments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of departments
 *   post:
 *     summary: Create a new department
 *     tags: [Departments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               manager: { type: string, description: "User ObjectId" }
 *     responses:
 *       201:
 *         description: Department created
 *
 * /departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Departments]
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
 *     tags: [Departments]
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
 *               name: { type: string }
 *               description: { type: string }
 *               manager: { type: string }
 *     responses:
 *       200:
 *         description: Department updated
 *   delete:
 *     summary: Delete department
 *     tags: [Departments]
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
router.post("/", auth, permission("CREATE_PROJECT"), departmentService.createDepartment);
router.get("/:id", auth, departmentService.getDepartmentById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), departmentService.updateDepartment);
router.delete("/:id", auth, permission("DELETE_PROJECT"), departmentService.deleteDepartment);

export default router;
