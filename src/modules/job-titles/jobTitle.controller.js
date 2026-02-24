import { Router } from "express";
import * as jobTitleService from "./jobTitle.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Job Titles
 *   description: Job Title Management APIs
 *
 * /job-titles:
 *   get:
 *     summary: Get all job titles
 *     tags: [Job Titles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of job titles
 *   post:
 *     summary: Create a new job title
 *     tags: [Job Titles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, department]
 *             properties:
 *               title: { type: string }
 *               department: { type: string, description: "Department ObjectId" }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Job Title created
 *
 * /job-titles/{id}:
 *   get:
 *     summary: Get job title by ID
 *     tags: [Job Titles]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Job Title details }
 *   put:
 *     summary: Update job title
 *     tags: [Job Titles]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Job Title updated }
 *   delete:
 *     summary: Delete job title
 *     tags: [Job Titles]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Job Title deleted }
 */

router.get("/", auth, jobTitleService.getAllJobTitles);
router.post("/", auth, permission("CREATE_PROJECT"), jobTitleService.createJobTitle);
router.get("/:id", auth, jobTitleService.getJobTitleById);
router.put("/:id", auth, permission("UPDATE_PROJECT"), jobTitleService.updateJobTitle);
router.delete("/:id", auth, permission("DELETE_PROJECT"), jobTitleService.deleteJobTitle);

export default router;
