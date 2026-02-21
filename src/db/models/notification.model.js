import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['INFO', 'WARNING', 'SUCCESS', 'ERROR'],
            default: 'INFO',
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        // Arbitrary payload, e.g. { projectId, documentId }
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
