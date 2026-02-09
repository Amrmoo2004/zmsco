import { Router } from "express";
import * as supplierService from "./supplier.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Suppliers
 *   description: Supplier Management APIs
 */

/**
 * @swagger
 * /suppliers:
 *   get:
 *     summary: Get all suppliers
 *     tags: [Suppliers]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of suppliers }
 *   post:
 *     summary: Create new supplier
 *     tags: [Suppliers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - contactPerson
 *               - phone
 *             properties:
 *               name: { type: string }
 *               contactPerson: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               address: { type: string }
 *               materials: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Supplier created }
 */
router.get("/", auth, permission("VIEW_REPORTS"), supplierService.getAllSuppliers);
router.post("/", auth, permission("CREATE_PROJECT"), supplierService.createSupplier);

/**
 * @swagger
 * /suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Supplier details }
 *   put:
 *     summary: Update supplier
 *     tags: [Suppliers]
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
 *               contactPerson: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               address: { type: string }
 *               materials: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Supplier updated }
 *   delete:
 *     summary: Delete supplier
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Supplier deleted }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), supplierService.getSupplierById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), supplierService.updateSupplier);
router.delete("/:id", auth, permission("DELETE_PROJECT"), supplierService.deleteSupplier);

/**
 * @swagger
 * /suppliers/{id}/orders:
 *   get:
 *     summary: Get supplier purchase orders
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Supplier orders }
 */
router.get("/:id/orders", auth, permission("VIEW_REPORTS"), supplierService.getSupplierOrders);

export default router;
