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

        // Signatories captured at certificate time
        signatories: [
            {
                name: String,
                role: String,
                signedAt: Date
            }
        ]
    },
    { timestamps: true }
);

// Auto-generate certificate number
certificateSchema.pre("save", async function (next) {
    if (!this.certificateNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model("Certificate").countDocuments();
        this.certificateNumber = `CERT-${year}-${String(count + 1).padStart(3, "0")}`;
    }
    next();
});

export default mongoose.model("Certificate", certificateSchema);
