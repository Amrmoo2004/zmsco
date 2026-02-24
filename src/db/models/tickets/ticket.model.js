import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
    {
        requestId: {
            type: String,
            unique: true
            // Auto-generated in pre-save: REQ-2025-001
        },

        type: {
            type: String,
            required: true,
            enum: ["MAINTENANCE", "SUPPORT", "INSPECTION", "OTHER"]
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project"
        },

        equipment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Equipment"
        },

        description: {
            type: String,
            required: true
        },

        priority: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            default: "MEDIUM"
        },

        targetDate: Date,

        status: {
            type: String,
            enum: ["NEW", "UNDER_REVIEW", "AWAITING_APPROVAL", "IN_PROGRESS", "COMPLETED", "REJECTED"],
            default: "NEW"
        },

        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        assignedTeam: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],

        rejectionReason: String,

        // Workflow History
        history: [
            {
                status: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                timestamp: { type: Date, default: Date.now },
                notes: String
            }
        ],

        // Comments
        comments: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                text: { type: String, required: true },
                createdAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

// Auto-generate requestId
ticketSchema.pre("save", async function (next) {
    if (!this.requestId) {
        const year = new Date().getFullYear();
        const count = await mongoose.model("Ticket").countDocuments();
        this.requestId = `REQ-${year}-${String(count + 1).padStart(3, "0")}`;
    }
    next();
});

export default mongoose.model("Ticket", ticketSchema);
