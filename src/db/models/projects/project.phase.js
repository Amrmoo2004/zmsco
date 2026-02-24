import mongoose from "mongoose";

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

    // ─── Phase Custom Data ────────────────────────────────────────────────────
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
    // ─────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

export default mongoose.model("ProjectPhase", projectPhaseSchema);
