import mongoose from "mongoose";

const materialTransactionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project"
    },

    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material"
    },

    quantity: Number,

    type: {
      type: String,
      enum: ["IN", "OUT", "TRANSFER", "ISSUE", "RETURN"],
      required: true
    },

    unitCost: Number,
    totalCost: Number,

    referenceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialRequest"
    },

    // ─── Warehouse Context ────────────────────────────────────────────────
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse"
    },
    fromWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse"
    },
    toWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse"
    },
    // ─────────────────────────────────────────────────────────────────────

    phase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectPhase"
    },

    // ─── Audit ───────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reference: String,        // free-text note (e.g. "Initial transfer for project X")
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED"
    }
    // ─────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

export default mongoose.model("MaterialTransaction", materialTransactionSchema);
