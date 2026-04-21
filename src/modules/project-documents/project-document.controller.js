import { Router } from "express";
import * as projectDocumentService from "./project-document.service.js";
import { auth } from "../../middlewares/auth.js";
import { permission } from "../../middlewares/premission.js";
import { uploadSingle } from "../../middlewares/upload.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Project Documents
 *   description: Project Document Management
 */

/**
 * @swagger
 * /projects/{projectId}/documents:
 *   get:
 *     summary: Get project documents
 *     tags: [Project Documents]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: phase
 *         schema: { type: string }
 *         description: "Filter by Phase ObjectId"
 *     responses:
 *       200: { description: List of documents }
 *   post:
 *     summary: Upload project document
 *     tags: [Project Documents]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: "اسم المرفق (اختياري، هيكتب اسم الملف لو فاضي)"
 *               phase:
 *                 type: string
 *                 description: "Phase ObjectId (اختياري للربط بمرحلة)"
 *               isRequired:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201: { description: Document uploaded }
 */
router.get("/:projectId/documents", auth, permission("VIEW_REPORTS"), projectDocumentService.getProjectDocuments);
router.post("/:projectId/documents", auth, permission("UPDATE_PROJECT"), uploadSingle("file"), projectDocumentService.uploadProjectDocument);

/**
 * @swagger
 * /projects/{projectId}/documents/{id}:
 *   get:
 *     summary: Get document details
 *     tags: [Project Documents]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Document details }
 *   delete:
 *     summary: Delete project document
 *     tags: [Project Documents]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Document deleted }
 */
router.get("/:projectId/documents/:id", auth, permission("VIEW_REPORTS"), projectDocumentService.getDocumentById);
router.delete("/:projectId/documents/:id", auth, permission("UPDATE_PROJECT"), projectDocumentService.deleteProjectDocument);

export default router;
