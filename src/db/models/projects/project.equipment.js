import mongoose from "mongoose";

const projectEquipmentSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        // ─── Phase Reference (optional) ───────────────────────────────────────
        phase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase"
        },

        // ─── Mode 1: Reference from Equipment Fleet (like materials) ──────────
        equipmentRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Equipment"
        },

        // ─── Mode 2: Free-form entry (manual) ─────────────────────────────────
        name: {
            type: String,
            required: true
        },
        count: {
            type: Number,
            default: 1
        },
        unit: {
            type: String,
            default: "وحدة" // e.g. وحدة، متر، مجموعات
        },
        ownershipType: {
            type: String,
            enum: ["OWNED", "RENTED", "BORROWED"],
            default: "OWNED"
        },
        location: {
            type: String, // e.g. المستودع أ، الموقع ب، مورد خارجي
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
