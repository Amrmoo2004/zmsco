import mongoose from "mongoose";

const phaseTaskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    description: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM"
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "PENDING"
    },
    completedAt: Date
  },
  { timestamps: true }
);

const projectPhaseSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    nameAr: { type: String },
    nameEn: { type: String },
    color: { type: String, default: "#10B981" },

    order: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED"],
      default: "PENDING"
    },

    expectedDays: Number,

    startDate: Date,
    endDate: Date,

    isRequired: {
      type: Boolean,
      default: true
    },

    // ─── Phase Gating: Role-based Approvals ───────────────────────────────────
    requiredApprovals: [
      {
        role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          default: "PENDING"
        },
        isMandatory: { type: Boolean, default: true },
        actionDate: Date,
        notes: String
      }
    ],

    // ─── Phase Gating: Required Attachments ──────────────────────────────────
    requiredAttachments: [
      {
        documentType: { type: String, required: true }, // e.g. "Safety Report"
        attachmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Attachment" },
        reviewStatus: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          default: "PENDING"
        },
        rejectionReason: String,
        isMandatory: { type: Boolean, default: true }
      }
    ],

    // ─── Phase Gating: Required Permits ──────────────────────────────────────
    requiredPermits: [
      {
        name: { type: String, required: true }, // e.g. "Building Permit"
        attachmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Attachment" },
        reviewStatus: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          default: "PENDING"
        },
        rejectionReason: String,
        isMandatory: { type: Boolean, default: true }
      }
    ],

    // ─── Phase Custom Data ────────────────────────────────────────────────────
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // ─── Phase Tasks ──────────────────────────────────────────────────────────
    tasks: [phaseTaskSchema]
    // ─────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

export default mongoose.model("ProjectPhase", projectPhaseSchema);
