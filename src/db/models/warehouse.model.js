import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    location: String,
    
    capacity: {
        type: Number,
        default: 1000
    },
    usedCapacity: {
        type: Number,
        default: 0
    },

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
