import mongoose from "mongoose";

const phaseFieldSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        type: { type: String, enum: ['text', 'textarea', 'number', 'date', 'file'], default: 'text' },
        isRequired: { type: Boolean, default: false }
    },
    { _id: false }
);

const phaseAttachmentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        type: { type: String, enum: ['PDF', 'IMAGE', 'ANY'], default: 'ANY' },
        isRequired: { type: Boolean, default: false }
    },
    { _id: false }
);


const phaseApprovalSchema = new mongoose.Schema(
    {
        entity: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
        isRequired: { type: Boolean, default: false }
    },
    { _id: false }
);

const taskTemplateSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        isRequired: { type: Boolean, default: true }
    },
    { _id: false }
);

const phaseTemplateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        order: {
            type: Number,
            required: true,
        },
        expectedDays: Number,
        isRequired: {
            type: Boolean,
            default: true,
        },
        fields: [phaseFieldSchema],
        attachments: [phaseAttachmentSchema],
        approvals: [phaseApprovalSchema],
        tasks: [taskTemplateSchema]
    },
    { _id: false, timestamps: true }
);



const projectTypeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        description: {
            type: String,
        },
        category: {
            type: String, // e.g., "إنشاءات", "تشغيل وصيانة"
        },
        phases: [phaseTemplateSchema],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ProjectType", projectTypeSchema);
