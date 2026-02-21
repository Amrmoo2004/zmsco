import multer from 'multer';
import { AppError } from '../utils/appError.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allow common document, image, and archive types
    const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-rar-compressed',
        'text/plain', 'text/csv',
        'video/mp4', 'video/quicktime',
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError(`File type '${file.mimetype}' is not allowed`, 400), false);
    }
};

const multerInstance = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

/**
 * Middleware to accept a single file under `fieldName`.
 * @param {string} fieldName - Form field name (default: 'file')
 */
export const uploadSingle = (fieldName = 'file') => multerInstance.single(fieldName);

/**
 * Middleware to accept multiple files under `fieldName`.
 * @param {string} fieldName
 * @param {number} maxCount
 */
export const uploadMultiple = (fieldName = 'files', maxCount = 10) =>
    multerInstance.array(fieldName, maxCount);
