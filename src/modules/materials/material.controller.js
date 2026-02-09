import { Router } from "express";
import * as materialService from "./material.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Materials
 *   description: Material Management APIs
 */

/**
 * @swagger
 * /materials:
 *   get:
 *     summary: Get all materials
 *     tags: [Materials]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of materials }
 *   post:
 *     summary: Create new material
 *     tags: [Materials]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - unit
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               unit: { type: string }
 *               category: { type: string }
 *               minStockLevel: { type: number }
 *     responses:
 *       201: { description: Material created }
 */
router.get("/", auth, permission("VIEW_REPORTS"), materialService.getAllMaterials);
router.post("/", auth, permission("CREATE_PROJECT"), materialService.createMaterial);

/**
 * @swagger
 * /materials/search:
 *   get:
 *     summary: Search materials by name or code
 *     tags: [Materials]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Search results }
 */
router.get("/search", auth, permission("VIEW_REPORTS"), materialService.searchMaterials);

/**
 * @swagger
 * /materials/{id}:
 *   get:
 *     summary: Get material by ID
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Material details }
 *   put:
 *     summary: Update material
 *     tags: [Materials]
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
 *               unit: { type: string }
 *               category: { type: string }
 *               minStockLevel: { type: number }
 *     responses:
 *       200: { description: Material updated }
 *   delete:
 *     summary: Delete material
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Material deleted }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), materialService.getMaterialById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), materialService.updateMaterial);
router.delete("/:id", auth, permission("DELETE_PROJECT"), materialService.deleteMaterial);

export default router;
