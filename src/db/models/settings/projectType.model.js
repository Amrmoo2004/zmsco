import mongoose from "mongoose";

const phaseTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        order: {
            type: Number,
            required: true,
        },
        expectedDays: Number,
        isRequired: {
            type: Boolean,
            default: true,
        },
        // Standard requirements for this phase across all projects of this type
        requiredDocumentTypes: [{ type: String }],
        requiredApprovalRoles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    },
    { timestamps: true }
);

const projectTypeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        description: {
            type: String,
        },
        phases: [phaseTemplateSchema],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ProjectType", projectTypeSchema);
