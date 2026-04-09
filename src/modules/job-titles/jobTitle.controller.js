import { Router } from "express";
import * as jobTitleService from "./jobTitle.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * /job-titles:
 *   get:
 *     summary: Get all job titles
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of job titles
 *   post:
 *     summary: Create a new job title
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nameAr, nameEn, code, department]
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               code: { type: string }
 *               department: { type: string, description: "Department ObjectId" }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Job Title created
 *
 * /job-titles/{id}:
 *   get:
 *     summary: Get job title by ID
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Job Title details }
 *   put:
 *     summary: Update job title
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nameAr: { type: string }
 *               nameEn: { type: string }
 *               code: { type: string }
 *               department: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Job Title updated }
 *   delete:
 *     summary: Delete job title
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Job Title deleted }
 */

router.get("/", auth, jobTitleService.getAllJobTitles);
router.post("/", auth, permission("MANAGE_HR"), jobTitleService.createJobTitle);
router.get("/:id", auth, jobTitleService.getJobTitleById);
router.put("/:id", auth, permission("MANAGE_HR"), jobTitleService.updateJobTitle);
router.delete("/:id", auth, permission("MANAGE_HR"), jobTitleService.deleteJobTitle);

export default router;
