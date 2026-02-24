import mongoose from "mongoose";

const phaseApprovalSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        phase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase",
            required: true
        },

        // Type of approval blocking the phase
        approvalType: {
            type: String,
            required: true,
            // e.g. 'Financial', 'Material', 'Safety', 'QA', etc.
        },

        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING"
        },

        // Link to the actual request (MaterialRequest, FinancialRequest, etc.)
        referenceModel: {
            type: String,
            enum: ["MaterialRequest", "PurchaseOrder", "MaintenanceRequest"]
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "referenceModel"
        },

        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        processedAt: Date,
        notes: String
    },
    { timestamps: true }
);

export default mongoose.model("PhaseApproval", phaseApprovalSchema);
