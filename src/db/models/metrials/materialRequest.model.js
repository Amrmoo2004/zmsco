import mongoose from "mongoose";

const materialRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["PENDING", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FULFILLED"],
      default: "PENDING"
    },

    // ── Workflow Engine Fields ──
    workflow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow"
    },
    currentStepIndex: {
      type: Number,
      default: 0
    },
    approvalHistory: [
      {
        stepIndex: Number,
        role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["APPROVED", "REJECTED"] },
        comment: String,
        timestamp: { type: Date, default: Date.now }
      }
    ],
    // ────────────────────────────

    items: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material"
        },
        quantity: Number
      }
    ],

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // ─── Added Context Fields ─────────────────────────────────────────────
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse"
    },

    phase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectPhase"
    },

    notes: String
    // ───────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

export default mongoose.model("MaterialRequest", materialRequestSchema);
