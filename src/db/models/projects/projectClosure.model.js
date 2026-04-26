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

        // ─── Closure Checklist ────────────────────────────────────────────────
        checklists: [
            {
                item: { type: String, required: true },
                description: { type: String },
                isMandatory: { type: Boolean, default: true },
                isCompleted: { type: Boolean, default: false },
                completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                completedAt: Date
            }
        ],

        // ─── Multi-level Approvals ────────────────────────────────────────────
        approvals: [
            {
                role: { type: String, required: true },
                roleLabel: { type: String },
                actionDescription: { type: String },
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

        // ─── Final Extract (المستخلص النهائي) ─────────────────────────────────
        finalExtract: {
            extractNumber: String,
            status: {
                type: String,
                enum: ["PENDING", "APPROVED"],
                default: "PENDING"
            },
            approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            approvedAt: Date,

            totalBudget: { type: Number, default: 0 },
            totalExpenses: { type: Number, default: 0 },

            materials: {
                budget: { type: Number, default: 0 },
                actual: { type: Number, default: 0 },
                items: [
                    {
                        category: String,
                        budget: { type: Number, default: 0 },
                        actual: { type: Number, default: 0 }
                    }
                ]
            },

            labor: {
                budget: { type: Number, default: 0 },
                actual: { type: Number, default: 0 },
                items: [
                    {
                        category: String,
                        count: { type: Number, default: 0 },
                        monthlyCost: { type: Number, default: 0 },
                        months: { type: Number, default: 0 },
                        total: { type: Number, default: 0 }
                    }
                ]
            },

            equipment: {
                budget: { type: Number, default: 0 },
                actual: { type: Number, default: 0 },
                items: [
                    {
                        name: String,
                        days: { type: Number, default: 0 },
                        dailyCost: { type: Number, default: 0 },
                        total: { type: Number, default: 0 }
                    }
                ]
            },

            otherExpenses: {
                items: [
                    {
                        name: String,
                        amount: { type: Number, default: 0 }
                    }
                ]
            }
        },

        // ─── Audit Log (سجل التدقيق) ─────────────────────────────────────────
        auditLog: [
            {
                action: { type: String, required: true },
                description: String,
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                userName: String,
                userRole: String,
                timestamp: { type: Date, default: Date.now }
            }
        ],

        // ─── Attached Documents (المستندات المرفقة) ───────────────────────────
        attachedDocuments: [
            {
                name: String,
                category: {
                    type: String,
                    enum: ["FINANCIAL", "TECHNICAL", "HR", "CERTIFICATES"]
                },
                isVerified: { type: Boolean, default: false }
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

// Auto-generate extract number
projectClosureSchema.pre("save", async function () {
    if (this.finalExtract && !this.finalExtract.extractNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model("ProjectClosure").countDocuments();
        this.finalExtract.extractNumber = `EXT-FINAL-${year}-${String(count + 1).padStart(3, "0")}`;
    }
});

export default mongoose.model("ProjectClosure", projectClosureSchema);
