import { Router } from "express";
import * as inventorySettingsService from "./inventorySettings.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventory Config
 *   description: Configurations for materials including categories and measurement units
 */

/**
 * @swagger
 * /inventory-settings/categories:
 *   get:
 *     summary: Get all material categories
 *     tags: [Inventory Config]
 *     responses:
 *       200: { description: List of categories }
 *   post:
 *     summary: Create a new material category
 *     tags: [Inventory Config]
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
 *     responses:
 *       201: { description: Category created }
 * 
 * /inventory-settings/categories/{id}:
 *   put:
 *     summary: Update category by ID
 *     tags: [Inventory Config]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Category updated }
 *   delete:
 *     summary: Delete category by ID
 *     tags: [Inventory Config]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Category deleted }
 */
router.get("/categories", auth, inventorySettingsService.getCategories);
router.post("/categories", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.createCategory);
router.put("/categories/:id", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.updateCategory);
router.delete("/categories/:id", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.deleteCategory);

/**
 * @swagger
 * /inventory-settings/units:
 *   get:
 *     summary: Get all measurement units
 *     tags: [Inventory Config]
 *     responses:
 *       200: { description: List of units }
 *   post:
 *     summary: Create a new measurement unit
 *     tags: [Inventory Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn, code, type]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               code: { type: string }
 *               type: { type: string, enum: ["طول", "وزن", "حجم", "عدد"] }
 *     responses:
 *       201: { description: Unit created }
 * 
 * /inventory-settings/units/{id}:
 *   put:
 *     summary: Update unit by ID
 *     tags: [Inventory Config]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Unit updated }
 *   delete:
 *     summary: Delete unit by ID
 *     tags: [Inventory Config]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Unit deleted }
 */
router.get("/units", auth, inventorySettingsService.getUnits);
router.post("/units", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.createUnit);
router.put("/units/:id", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.updateUnit);
router.delete("/units/:id", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.deleteUnit);

export default router;
