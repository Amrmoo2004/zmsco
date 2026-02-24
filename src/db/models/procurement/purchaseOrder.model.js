import mongoose from "mongoose";
import "./supplier.model.js"; // Ensure Supplier model is registered

const purchaseOrderSchema = new mongoose.Schema(
    {
        rfq: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RFQ"
        },

        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier" // You might need to check if Supplier model exists or needs to be created
        },

        items: [
            {
                material: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Material"
                },
                quantity: Number,
                unitPrice: Number
            }
        ],

        totalAmount: Number,

        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED"],
            default: "PENDING"
        },

        // ─── Additional Context ─────────────────────────────────────────────────
        quote: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quote"
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project"
        },

        warehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Warehouse"
        },

        deliveryDate: Date,
        paymentTerms: String,
        // ───────────────────────────────────────────────────────────────────────

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
