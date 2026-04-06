import mongoose from "mongoose";

const measurementUnitSchema = new mongoose.Schema(
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
        type: {
            type: String,
            required: true,
            enum: ["طول", "وزن", "حجم", "عدد"], // Length, Weight, Volume, Count
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    { timestamps: true }
);

export default mongoose.model("MeasurementUnit", measurementUnitSchema);
