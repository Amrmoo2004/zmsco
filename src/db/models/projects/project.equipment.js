import mongoose from "mongoose";

const projectEquipmentSchema = new mongoose.Schema(
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
        count: {
            type: Number,
            default: 1
        },
        status: {
            type: String,
            enum: ["PENDING", "ACTIVE", "RELEASED"],
            default: "PENDING"
        },
        unitCost: {
            type: Number,
            default: 0
        },
        totalCost: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

export default mongoose.model("ProjectEquipment", projectEquipmentSchema);
