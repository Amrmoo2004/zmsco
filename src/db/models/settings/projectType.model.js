import mongoose from "mongoose";

const phaseFieldSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'date', 'file'], default: 'text' },
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
        approvals: [phaseApprovalSchema]
    },
    { _id: false, timestamps: true }
);

const materialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, required: true },
    defaultQuantity: { type: Number, default: 0 }
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    unit: { type: String, required: true },
    defaultQuantity: { type: Number, default: 1 }
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    defaultCount: { type: Number, default: 1 },
    systemRole: { type: mongoose.Schema.Types.ObjectId, ref: "Role" }
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    required: { type: Boolean, default: true }
  },
  { _id: false }
);

const rulesSchema = new mongoose.Schema(
  {
    inventoryTracking: { type: Boolean, default: true },
    stockAlert: { type: Boolean, default: true },
    approvalRequired: { type: Boolean, default: true }
  },
  { _id: false }
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
        phases: [phaseTemplateSchema],
        materials: [materialSchema],
        equipments: [equipmentSchema],
        employees: [employeeSchema],
        attachments: [attachmentSchema],
        rules: rulesSchema,
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ProjectType", projectTypeSchema);
