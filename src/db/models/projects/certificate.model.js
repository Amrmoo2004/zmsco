import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
    {
        certificateNumber: {
            type: String,
            unique: true
            // Auto-generated: CERT-2025-001
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            unique: true
        },

        projectClosure: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectClosure"
        },

        issuedDate: {
            type: Date,
            default: Date.now
        },

        issuedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        pdfUrl: String,

        // ─── Project Snapshot (بيانات المشروع وقت الشهادة) ────────────────────
        projectName: String,
        projectCode: String,
        managerName: String,
        completionDate: Date,
        duration: String,
        finalCost: { type: Number, default: 0 },
        budget: { type: Number, default: 0 },

        // ─── الإنجازات الرئيسية ───────────────────────────────────────────────
        achievements: [
            {
                text: String,
                icon: { type: String, default: "check" }
            }
        ],

        // ─── Signatories ──────────────────────────────────────────────────────
        signatories: [
            {
                name: String,
                role: String,
                roleEn: String,
                signedAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

// Auto-generate certificate number
certificateSchema.pre("save", async function () {
    if (!this.certificateNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model("Certificate").countDocuments();
        this.certificateNumber = `CERT-${year}-${String(count + 1).padStart(3, "0")}`;
    }
});

export default mongoose.model("Certificate", certificateSchema);
