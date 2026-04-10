import mongoose from "mongoose";

const jobTitleSchema = new mongoose.Schema(
    {
        nameAr: {
            type: String,
            required: true,
        },
        nameEn: {
            type: String,
            required: true,
        },
        code: {
            type: String,
            required: true,
            unique: true,
        },
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },
        description: {
            type: String,
        },
        estimatedDailyCost: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("JobTitle", jobTitleSchema);
