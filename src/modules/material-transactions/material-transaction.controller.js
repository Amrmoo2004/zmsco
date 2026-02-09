import { Router } from "express";
import * as materialTransactionService from "./material-transaction.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Material Transactions
 *   description: Material Movement Tracking
 */

/**
 * @swagger
 * /material-transactions:
 *   get:
 *     summary: Get all material transactions
 *     tags: [Material Transactions]
 *     parameters:
 *       - in: query
 *         name: material
 *         schema: { type: string }
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *       - in: query
 *         name: warehouse
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [IN, OUT] }
 *     responses:
 *       200: { description: List of transactions }
 *   post:
 *     summary: Create material transaction
 *     tags: [Material Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - material
 *               - quantity
 *               - type
 *               - warehouse
 *             properties:
 *               material: { type: string }
 *               quantity: { type: number }
 *               type: { type: string, enum: [IN, OUT] }
 *               warehouse: { type: string }
 *               project: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Transaction created }
 */
router.get("/", auth, permission("VIEW_REPORTS"), materialTransactionService.getAllTransactions);
router.post("/", auth, permission("CREATE_PROJECT"), materialTransactionService.createTransaction);

/**
 * @swagger
 * /material-transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Material Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Transaction details }
 */
router.get("/:id", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionById);

/**
 * @swagger
 * /material-transactions/material/{materialId}:
 *   get:
 *     summary: Get transactions by material
 *     tags: [Material Transactions]
 *     parameters:
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Material transactions }
 */
router.get("/material/:materialId", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionsByMaterial);

/**
 * @swagger
 * /material-transactions/project/{projectId}:
 *   get:
 *     summary: Get transactions by project
 *     tags: [Material Transactions]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project transactions }
 */
router.get("/project/:projectId", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionsByProject);

export default router;
