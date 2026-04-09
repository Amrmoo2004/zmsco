import mongoose from "mongoose";

const documentTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            required: true // e.g., "عقد", "أمر شراء", "إذن صرف مواد", "شهادة إنجاز"
        },
        category: {
            type: String,
            required: true // e.g., "عربي", "عربي/إنجليزي"
        },
        version: {
            type: String,
            default: "v1.0"
        },
        content: {
            type: String, // Storing HTML or rich text structure
            required: false 
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("DocumentTemplate", documentTemplateSchema);
