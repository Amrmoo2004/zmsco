import mongoose from "mongoose";

const projectPhaseTemplateSchema = new mongoose.Schema(
    {
        nameAr: {
            type: String,
            required: true,
        },
        nameEn: {
            type: String,
            required: true,
        },
        color: {
            type: String,
            default: "#10B981", // default pleasant color
        },
        order: {
            type: Number,
            required: true,
            default: 1,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ProjectPhaseTemplate", projectPhaseTemplateSchema);
