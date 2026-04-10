import mongoose from "mongoose";

const kpiSchema = new mongoose.Schema(
    {
        nameAr: {
            type: String,
            required: true,
        },
        nameEn: {
            type: String,
            required: true,
        },
        unit: {
            type: String,
            default: "%", // %, SAR, Days, etc.
        },
        targetValue: {
            type: Number,
            required: true,
            default: 100,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ProjectKpi", kpiSchema);
