import mongoose from "mongoose";

const materialCategorySchema = new mongoose.Schema(
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
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    { timestamps: true }
);

export default mongoose.model("MaterialCategory", materialCategorySchema);
