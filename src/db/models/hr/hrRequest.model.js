import mongoose from "mongoose";

const hrRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        requestType: {
            type: String,
            required: true,
            enum: ["LEAVE", "REPLACEMENT", "OVERTIME", "ADVANCE"]
        },
        startDate: Date,
        endDate: Date,
        reason: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING"
        },
        relatedProject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project"
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        processedAt: Date,
        rejectionReason: String
    },
    { timestamps: true }
);

export default mongoose.model("HrRequest", hrRequestSchema);
