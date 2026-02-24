import mongoose from "mongoose";

const rfqSchema = new mongoose.Schema(
    {
        items: [
            {
                material: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Material",
                    required: true
                },
                quantity: {
                    type: Number,
                    required: true
                }
            }
        ],

        status: {
            type: String,
            enum: ["DRAFT", "SENT", "CLOSED"],
            default: "DRAFT"
        },

        deadline: Date,

        // ─── Multi-Vendor & Project Context ────────────────────────────────────
        suppliers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier"
        }],

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project"
        },

        phase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectPhase"
        },

        warehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Warehouse"
        },
        // ───────────────────────────────────────────────────────────────────────

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

export default mongoose.model("RFQ", rfqSchema);
