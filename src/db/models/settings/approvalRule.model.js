import mongoose from "mongoose";

const approvalRuleSchema = new mongoose.Schema(
    {
        entityType: {
            type: String,
            required: true,
            enum: ['MaterialRequest', 'PurchaseOrder', 'ProjectClosure', 'PhaseApproval', 'MaintenanceRequest', 'LeaveRequest'],
        },
        description: {
            type: String,
            required: true,
        },
        condition: {
            isAlways: { type: Boolean, default: false },
            minAmount: { type: Number },
            maxAmount: { type: Number }
        },
        workflow: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workflow",
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ApprovalRule", approvalRuleSchema);
