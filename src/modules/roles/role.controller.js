import { Router } from "express";
import * as roleService from "./role.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: System Settings - Departments, Job Titles, Workflows, Project Types, Roles & Configurations
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Settings]
 *     responses:
 *       200: { description: List of roles }
 *   post:
 *     summary: Create new role
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Role created }
 */
router.get("/", auth, permission("MANAGE_ROLES"), roleService.getAllRoles);
router.post("/", auth, permission("MANAGE_ROLES"), roleService.createRole);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Role details }
 *   put:
 *     summary: Update role
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Role updated }
 *   delete:
 *     summary: Delete role
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Role deleted }
 */
router.get("/:id", auth, permission("MANAGE_ROLES"), roleService.getRoleById);
router.put("/:id", auth, permission("MANAGE_ROLES"), roleService.updateRole);
router.delete("/:id", auth, permission("MANAGE_ROLES"), roleService.deleteRole);

export default router;
