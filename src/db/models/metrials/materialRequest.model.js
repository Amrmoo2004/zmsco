import mongoose from "mongoose";

const materialRequestSchema = new mongoose.Schema(
  {
    // ── Auto-generated request number e.g. MAT-2025-001 ──────────────────────
    requestNumber: {
      type: String,
      unique: true
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    // الـ phase اللي الطلب خاص بيها (اختياري)
    phase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectPhase"
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // المستودع المصدر اللي هيتصرف منه (Step 1 في الـ Modal)
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true
    },

    status: {
      type: String,
      enum: ["PENDING", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FULFILLED"],
      default: "PENDING"
    },

    // ── قائمة المواد المطلوبة ──────────────────────────────────────────────
    materials: [
      {
        material: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        // السعر المسحوب من standardCost وقت إنشاء الطلب
        unitCost: {
          type: Number,
          default: 0
        },
        // quantity × unitCost
        totalCost: {
          type: Number,
          default: 0
        }
      }
    ],

    // إجمالي التكلفة للطلب كله
    totalRequestCost: {
      type: Number,
      default: 0
    },

    // ── Workflow Engine Fields ──────────────────────────────────────────────
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
    // ───────────────────────────────────────────────────────────────────────

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    rejectionReason: String,

    notes: String
  },
  { timestamps: true }
);

// ── Auto-generate requestNumber before save ────────────────────────────────
materialRequestSchema.pre("save", async function () {
  if (this.isNew && !this.requestNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("MaterialRequest").countDocuments();
    const seq = String(count + 1).padStart(3, "0");
    this.requestNumber = `MAT-${year}-${seq}`;
  }
});

export default mongoose.model("MaterialRequest", materialRequestSchema);
