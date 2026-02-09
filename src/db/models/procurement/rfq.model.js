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

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

export default mongoose.model("RFQ", rfqSchema);
