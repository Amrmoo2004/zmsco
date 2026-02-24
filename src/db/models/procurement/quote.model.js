import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
    {
        rfq: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RFQ",
            required: true
        },
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier",
            required: true
        },
        items: [
            {
                material: { type: mongoose.Schema.Types.ObjectId, ref: "Material" },
                description: String,
                quantity: { type: Number, required: true },
                unitPrice: { type: Number, required: true },
                totalPrice: Number
            }
        ],
        totalAmount: { type: Number, default: 0 },
        deliveryDays: Number,
        paymentTerms: String,
        validityDays: Number,
        notes: String,
        status: {
            type: String,
            enum: ["PENDING", "SELECTED", "REJECTED"],
            default: "PENDING"
        },
        submittedAt: Date
    },
    { timestamps: true }
);

// Auto-calculate total
quoteSchema.pre("save", function (next) {
    this.items.forEach(item => {
        item.totalPrice = item.quantity * item.unitPrice;
    });
    this.totalAmount = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    next();
});

export default mongoose.model("Quote", quoteSchema);
