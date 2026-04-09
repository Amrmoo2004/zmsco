import mongoose from "mongoose";

const workflowSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        entityType: {
            type: String,
            required: true,
            enum: ['مشتريات', 'مخزون', 'موارد بشرية', 'مشروع'],
        },
        steps: [
            {
                stepOrder: { type: Number, required: true },
                role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                isMandatory: { type: Boolean, default: true }
            }
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Workflow", workflowSchema);
