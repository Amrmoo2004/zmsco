import mongoose from "mongoose";

// ─── Equipment (Central Fleet Registry) ──────────────────────────────────────
const equipmentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        type: { type: String, required: true }, // e.g. Crane, Mixer, Generator
        brand: String,
        model: String,
        serialNumber: { type: String, unique: true, sparse: true },
        capacity: String,
        condition: {
            type: String,
            enum: ["EXCELLENT", "GOOD", "FAIR", "POOR", "UNDER_MAINTENANCE"],
            default: "GOOD"
        },
        purchaseDate: Date,
        dailyCost: { type: Number, default: 0 },
        operatingHours: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

// ─── Equipment Maintenance Log ────────────────────────────────────────────────
const equipmentMaintenanceSchema = new mongoose.Schema(
    {
        equipment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Equipment",
            required: true
        },
        date: { type: Date, required: true },
        type: {
            type: String,
            enum: ["INSPECTION", "PREVENTIVE", "CORRECTIVE"],
            default: "PREVENTIVE"
        },
        cost: { type: Number, default: 0 },
        description: String,
        performedBy: String,
        nextMaintenanceDate: Date
    },
    { timestamps: true }
);

// ─── Equipment Assignment to Projects ────────────────────────────────────────
const equipmentAssignmentSchema = new mongoose.Schema(
    {
        equipment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Equipment",
            required: true
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        phase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase"
        },
        startDate: { type: Date, required: true },
        endDate: Date,
        status: {
            type: String,
            enum: ["ACTIVE", "RETURNED", "CANCELLED"],
            default: "ACTIVE"
        },
        allocationPercentage: { type: Number, default: 100 },
        dailyCostSnapshot: Number, // snapshot at assignment time
        notes: String
    },
    { timestamps: true }
);

export const Equipment = mongoose.model("Equipment", equipmentSchema);
export const EquipmentMaintenance = mongoose.model("EquipmentMaintenance", equipmentMaintenanceSchema);
export const EquipmentAssignment = mongoose.model("EquipmentAssignment", equipmentAssignmentSchema);
