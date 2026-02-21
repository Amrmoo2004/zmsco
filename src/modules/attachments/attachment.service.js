import Attachment from '../../db/models/attachment.model.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';
import { asynchandler } from '../../utils/response/response.js';
import { AppError } from '../../utils/appError.js';

/**
 * Upload a file to Cloudinary and save the resulting URL in Attachment model.
 * Used by the generic upload endpoint and by other services.
 *
 * @param {object} file     - multer file object (buffer, mimetype, originalname, size)
 * @param {string} userId   - uploader's user _id
 * @param {object} ref      - optional { refModel, refId } for polymorphic assignment
 * @param {string} folder   - Cloudinary folder name
 * @returns {Promise<Attachment>}
 */
export const uploadFile = async (file, userId, ref = {}, folder = 'zmsco-uploads') => {
    if (!file) throw new AppError('No file provided', 400);

    const { url, publicId } = await uploadToCloudinary(
        file.buffer,
        file.originalname,
        file.mimetype,
        folder
    );

    const attachment = await Attachment.create({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        publicId,
        uploadedBy: userId,
        refModel: ref.refModel || null,
        refId: ref.refId || null,
    });

    return attachment;
};

/**
 * DELETE a Cloudinary file and remove the Attachment record.
 * @param {string} attachmentId
 * @param {string} userId
 */
export const removeFile = async (attachmentId, userId) => {
    const attachment = await Attachment.findOne({ _id: attachmentId, uploadedBy: userId });
    if (!attachment) throw new AppError('Attachment not found', 404);

    const resourceType = attachment.mimeType.startsWith('image/') ? 'image'
        : attachment.mimeType.startsWith('video/') ? 'video'
            : 'raw';

    await deleteFromCloudinary(attachment.publicId, resourceType);
    await attachment.deleteOne();
};

// ─── HTTP Handlers ────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Uploads a single file (multipart/form-data, field: 'file')
 * Returns the Attachment document with the Cloudinary URL.
 */
export const uploadFileHandler = asynchandler(async (req, res, next) => {
    if (!req.file) return next(new AppError('No file uploaded. Use field name "file"', 400));

    const { refModel, refId } = req.body;

    const attachment = await uploadFile(req.file, req.user._id, { refModel, refId });

    return res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
            url: attachment.url,
            attachment,
        },
    });
});

/**
 * GET /api/upload — list attachments uploaded by the current user
 */
export const listAttachments = asynchandler(async (req, res) => {
    const attachments = await Attachment.find({ uploadedBy: req.user._id })
        .sort({ createdAt: -1 })
        .limit(100);

    return res.status(200).json({ success: true, data: attachments });
});

/**
 * DELETE /api/upload/:id — delete an attachment (only uploader can delete)
 */
export const deleteAttachmentHandler = asynchandler(async (req, res, next) => {
    try {
        await removeFile(req.params.id, req.user._id);
        return res.status(200).json({ success: true, message: 'Attachment deleted' });
    } catch (err) {
        return next(err);
    }
});
