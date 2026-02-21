import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
    {
        originalName: {
            type: String,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        size: {
            type: Number, // bytes
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        publicId: {
            type: String, // Cloudinary public_id (used for deletion)
            required: true,
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Polymorphic reference — optional context
        refModel: {
            type: String,
            enum: ['ProjectDocument', 'MaterialRequest', 'ProcurementOrder', null],
            default: null,
        },
        refId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
    },
    { timestamps: true }
);

export default mongoose.model('Attachment', attachmentSchema);
