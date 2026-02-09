import mongoose from "mongoose";

const projectDocumentSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        name: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["PENDING", "UPLOADED", "APPROVED", "REJECTED"],
            default: "PENDING"
        },
        fileUrl: {
            type: String
        },
        isRequired: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("ProjectDocument", projectDocumentSchema);
