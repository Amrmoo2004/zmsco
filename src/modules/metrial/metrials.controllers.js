import express from "express";
import * as service from "./metrials.services.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Materials
 *   description: Material request management
 */

/**
 * @swagger
 * /materials:
 *   post:
 *     summary: Create a material request
 *     tags: [Materials]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project
 *               - items
 *             properties:
 *               project:
 *                 type: string
 *                 description: Project ID
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     item:
 *                       type: string
 *                     quantity:
 *                       type: number
 *     responses:
 *       201:
 *         description: Material request created
 */
router.post(
  "/",
  auth,
  permission("REQUEST_MATERIAL"),
  async (req, res) => {
    const data = await service.create_request({
      project: req.body.project,
      items: req.body.items,
      userId: req.user.id
    });

    res.status(201).json({ success: true, data });
  }
);

/**
 * @swagger
 * /materials/{id}/approve:
 *   patch:
 *     summary: Approve a material request
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request approved
 */
router.patch(
  "/:id/approve",
  auth,
  permission("APPROVE_MATERIAL"),
  async (req, res) => {
    const data = await service.approve_request(req.params.id, req.user.id);
    res.json({ success: true, data });
  }
);

/**
 * @swagger
 * /materials/{id}/issue:
 *   patch:
 *     summary: Issue materials from warehouse
 *     tags: [Materials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Materials issued
 */
router.patch(
  "/:id/issue",
  auth,
  permission("ISSUE_MATERIAL"),
  async (req, res) => {
    const data = await service.issue_request(req.params.id, req.user.id);
    res.json({ success: true, data });
  }
);

export default router;
