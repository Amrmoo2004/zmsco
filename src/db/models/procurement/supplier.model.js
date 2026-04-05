import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        contactPerson: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        address: {
            type: String
        },
        category: {
            type: String, // e.g., "Construction Materials", "Electronics"
            default: "General"
        },
        // Materials this supplier provides (references to Material catalog)
        materials: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Material"
            }
        ],
        isActive: {
            type: Boolean,
            default: true
        },
        notes: {
            type: String
        }
    },
    { timestamps: true }
);

export default mongoose.model("Supplier", supplierSchema);
