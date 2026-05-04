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
        type: { type: String, enum: ['PDF', 'IMAGE', 'file', 'text'], default: 'file' }, 
        isRequired: { type: Boolean, default: false }
    },
    { _id: false }
);


const phaseApprovalSchema = new mongoose.Schema(
    {
        name: { type: String }, // To hold the text entered in frontend
        entity: { type: mongoose.Schema.Types.ObjectId, ref: "Role" }, // Optional at creation
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
        nameAr: {
            type: String,
            required: function () {
                return !this.nameEn; // إذا ما فيه nameEn، يجب أن يكون nameAr موجود
            },
            trim: true,
        },
        nameEn: {
            type: String,
            required: function () {
                return !this.nameAr; // إذا ما فيه nameAr، يجب أن يكون nameEn موجود
            },
            trim: true,
        },
        color: {
            type: String,
            default: "#10B981"
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
        permits: [
            {
                name: { type: String, required: true }, // e.g. "Building Permit"
                isRequired: { type: Boolean, default: true }
            }
        ],
        tasks: [taskTemplateSchema]
    },
    { _id: false, timestamps: true }
);



const projectTypeSchema = new mongoose.Schema(
    {
        nameAr: {
            type: String,
        },
        nameEn: {
            type: String,
        },
        code: {
            type: String,
            unique: true,
        },
        description: {
            type: String,
        },
        category: {
            type: String, // e.g., "إنشاءات", "تشغيل وصيانة"
        },
        phases: [phaseTemplateSchema],
        defaultResources: {
            employees: [
                {
                    jobTitle: { type: mongoose.Schema.Types.ObjectId, ref: "JobTitle", required: true },
                    count: { type: Number, default: 1 }
                }
            ],
            materials: [
                {
                    material: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
                    quantity: { type: Number, default: 0 }
                }
            ],
            equipments: [
                {
                    name: { type: String, required: true },
                    count: { type: Number, default: 1 },
                    unit: { type: String, default: "وحدة" }, // e.g. وحدة, متر, مجموعات
                    estimatedDailyCost: { type: Number, default: 0 }
                }
            ]
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ProjectType", projectTypeSchema);
