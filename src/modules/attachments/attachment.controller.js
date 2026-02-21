import { Router } from 'express';
import { auth } from '../../middlewares/auth.js';
import { uploadSingle } from '../../middlewares/upload.js';
import {
    uploadFileHandler,
    listAttachments,
    deleteAttachmentHandler,
} from './attachment.service.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Attachments
 *   description: File upload management (Cloudinary)
 */

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload a file to Cloudinary
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               refModel:
 *                 type: string
 *                 description: "Optional: model name this file belongs to"
 *               refId:
 *                 type: string
 *                 description: "Optional: document _id this file belongs to"
 *     responses:
 *       201:
 *         description: File uploaded - returns Cloudinary URL and Attachment record
 */
router.post('/', auth, uploadSingle('file'), uploadFileHandler);

/**
 * @swagger
 * /upload:
 *   get:
 *     summary: List my uploaded attachments
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of attachments
 */
router.get('/', auth, listAttachments);

/**
 * @swagger
 * /upload/{id}:
 *   delete:
 *     summary: Delete an attachment
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Attachment deleted
 */
router.delete('/:id', auth, deleteAttachmentHandler);

export default router;
