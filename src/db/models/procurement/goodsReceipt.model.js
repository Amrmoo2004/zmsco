import mongoose from "mongoose";

const goodsReceiptSchema = new mongoose.Schema(
    {
        po: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PurchaseOrder",
            required: true
        },
        receivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        receiptDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        deliveryNoteNumber: String,
        items: [
            {
                material: { type: mongoose.Schema.Types.ObjectId, ref: "Material" },
                description: String,
                orderedQuantity: Number,
                receivedQuantity: { type: Number, required: true }
            }
        ],
        warehouse: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Warehouse"
        },
        notes: String
    },
    { timestamps: true }
);

export default mongoose.model("GoodsReceipt", goodsReceiptSchema);
