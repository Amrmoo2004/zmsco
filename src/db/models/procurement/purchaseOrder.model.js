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
            enum: ["PENDING", "APPROVED", "SENT", "RECEIVED"],
            default: "PENDING"
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
