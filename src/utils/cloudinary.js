import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {string} originalname - Original filename (used to derive public_id)
 * @param {string} mimetype - MIME type
 * @param {string} folder - Cloudinary folder (default: 'zmsco-uploads')
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export const uploadToCloudinary = (buffer, originalname, mimetype, folder = 'zmsco-uploads') => {
    return new Promise((resolve, reject) => {
        const resourceType = mimetype.startsWith('image/') ? 'image'
            : mimetype.startsWith('video/') ? 'video'
                : 'raw';

        let options = {
            folder,
            resource_type: resourceType,
        };

        if (originalname) {
            const ext = path.extname(originalname);
            const base = path.basename(originalname, ext).replace(/\s+/g, '_');
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            options.public_id = resourceType === 'raw' 
                ? `${base}_${uniqueSuffix}${ext}` 
                : `${base}_${uniqueSuffix}`;
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error) return reject(error);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );

        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
};

/**
 * Delete a file from Cloudinary by its public_id.
 * @param {string} publicId
 * @param {string} resourceType - 'image' | 'video' | 'raw'
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'raw') => {
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export default cloudinary;
