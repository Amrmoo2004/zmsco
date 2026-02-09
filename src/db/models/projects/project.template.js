import mongoose from "mongoose";

const phaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
    isRequired: { type: Boolean, default: true },
    expectedDays: { type: Number }
  },
  { _id: false }
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

const projectTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: [
        "INFRASTRUCTURE",
        "TECHNOLOGY",
        "MAINTENANCE",
        "TRANSFORMATION"
      ],
      required: true
    },

    phases: [phaseSchema],
    materials: [materialSchema],
    equipments: [equipmentSchema],
    employees: [employeeSchema],
    attachments: [attachmentSchema],

    rules: rulesSchema,

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

export default mongoose.model("ProjectTemplate", projectTemplateSchema);
