import mongoose from "mongoose";

const projectClosureSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            unique: true
        },

        closureStatus: {
            type: String,
            enum: ["INITIATED", "PENDING_APPROVALS", "CLOSED"],
            default: "INITIATED"
        },

        // 5-step closure checklist (Site Delivery, Material Return, Financial Clearance, etc.)
        checklists: [
            {
                item: { type: String, required: true },
                isCompleted: { type: Boolean, default: false },
                completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                completedAt: Date
            }
        ],

        // Final multi-level approvals (PM → Financial Director → CEO)
        approvals: [
            {
                role: { type: String, required: true }, // e.g., 'PROJECT_MANAGER', 'FINANCIAL_DIRECTOR', 'CEO'
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                status: {
                    type: String,
                    enum: ["PENDING", "APPROVED", "REJECTED"],
                    default: "PENDING"
                },
                actionDate: Date,
                notes: String
            }
        ],

        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        initiatedAt: Date,
        closedAt: Date
    },
    { timestamps: true }
);

export default mongoose.model("ProjectClosure", projectClosureSchema);
