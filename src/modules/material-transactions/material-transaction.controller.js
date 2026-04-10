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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: material
 *         schema: { type: string }
 *         description: MongoDB ObjectId for material
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *         description: MongoDB ObjectId for project
 *       - in: query
 *         name: warehouse
 *         schema: { type: string }
 *         description: MongoDB ObjectId for warehouse
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [IN, OUT] }
 *     responses:
 *       200: { description: List of transactions }
 *   post:
 *     summary: Create one or multiple material transactions
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - material
 *                 - quantity
 *                 - type
 *                 - warehouse
 *               properties:
 *                 material: { type: string, description: "MongoDB ObjectId for material" }
 *                 quantity: { type: number }
 *                 type: { type: string, enum: [IN, OUT], description: "Transaction Type" }
 *                 warehouse: { type: string, description: "MongoDB ObjectId for warehouse" }
 *                 project: { type: string, description: "MongoDB ObjectId for project" }
 *                 notes: { type: string }
 *                 referenceRequest: { type: string, description: "MongoDB ObjectId for Material Request" }
 *     responses:
 *       201: { description: Transactions created successfully }
 */
router.get("/", auth, permission("VIEW_REPORTS"), materialTransactionService.getAllTransactions);
router.post("/", auth, permission("CREATE_PROJECT"), materialTransactionService.createTransaction);

/**
 * @swagger
 * /material-transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Material Transactions]
 *     security: [{ bearerAuth: [] }]
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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId for material
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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId for project
 *     responses:
 *       200: { description: Project transactions }
 */
router.get("/project/:projectId", auth, permission("VIEW_REPORTS"), materialTransactionService.getTransactionsByProject);

export default router;
