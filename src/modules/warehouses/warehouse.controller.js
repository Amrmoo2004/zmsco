import { Router } from "express";
import * as warehouseService from "./warehouse.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Warehouses
 *   description: Warehouse Management APIs
 */

/**
 * @swagger
 * /warehouses:
 *   get:
 *     summary: Get all warehouses
 *     tags: [Warehouses]
 *     responses:
 *       200: { description: List of warehouses }
 *   post:
 *     summary: Create new warehouse
 *     tags: [Warehouses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *             properties:
 *               name: { type: string }
 *               location: { type: string }
 *               capacity: { type: number }
 *               manager: { type: string }
 *     responses:
 *       201: { description: Warehouse created }
 */
router.get("/", auth, permission("VIEW_REPORTS"), warehouseService.getAllWarehouses);
router.post("/", auth, permission("CREATE_PROJECT"), warehouseService.createWarehouse);

/**
 * @swagger
 * /warehouses/{id}:
 *   get:
 *     summary: Get warehouse by ID
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Warehouse details }
 *   put:
 *     summary: Update warehouse
 *     tags: [Warehouses]
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
 *               location: { type: string }
 *               capacity: { type: number }
 *               manager: { type: string }
 *     responses:
 *       200: { description: Warehouse updated }
 *   delete:
 *     summary: Delete warehouse
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Warehouse deleted }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), warehouseService.getWarehouseById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), warehouseService.updateWarehouse);
router.delete("/:id", auth, permission("DELETE_PROJECT"), warehouseService.deleteWarehouse);

/**
 * @swagger
 * /warehouses/{id}/inventory:
 *   get:
 *     summary: Get warehouse inventory
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Warehouse inventory }
 */
router.get("/:id/inventory", auth, permission("VIEW_REPORTS"), warehouseService.getWarehouseInventory);

/**
 * @swagger
 * /warehouses/{id}/transactions:
 *   get:
 *     summary: Get warehouse transactions
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Warehouse transactions }
 */
router.get("/:id/transactions", auth, permission("VIEW_REPORTS"), warehouseService.getWarehouseTransactions);

export default router;
