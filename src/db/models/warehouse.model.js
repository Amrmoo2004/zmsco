import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    location: String,

    type: {
        type: String,
        enum: ["MAIN", "PROJECT"],
        default: "MAIN"
    },

    // If usage is DEDICATED for a project
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project"
    },

    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

export default mongoose.model("Warehouse", warehouseSchema);
