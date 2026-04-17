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
/**
 * @swagger
 * /inventory-settings/config:
 *   get:
 *     summary: Get inventory settings (singleton)
 *     description: Returns the single inventory configuration document. Auto-created with defaults if not found.
 *     tags: [Inventory Config]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Inventory settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lowStockThreshold: { type: number, example: 10 }
 *                 expiryAlertDays: { type: number, example: 30 }
 *                 batchTracking: { type: boolean }
 *                 serialNumberTracking: { type: boolean }
 *                 requireIssuanceApproval: { type: boolean }
 *   put:
 *     summary: Update inventory settings
 *     description: |
 *       Updates the inventory configuration. Side-effects:
 *       - If `lowStockThreshold` changes → sends a notification listing items now below threshold
 *     tags: [Inventory Config]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             lowStockAlerts: true
 *             lowStockThreshold: 15
 *             expiryAlerts: true
 *             expiryAlertDays: 14
 *             batchTracking: false
 *             serialNumberTracking: true
 *             requireIssuanceApproval: true
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.get("/config", auth, inventorySettingsService.getInventoryConfig);
router.put("/config", auth, permission("MANAGE_SETTINGS"), inventorySettingsService.updateInventoryConfig);

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
 *               type: { type: string, description: "MongoDB ObjectId" }
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
