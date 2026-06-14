import mongoose from "mongoose";

const projectMemberSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    // مسمى وظيفي داخل المشروع
    role: {
      type: String,
      required: true // "Backend Dev", "Designer"
    },

    // No systemRole anymore, just the job description.

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },

    jobTitle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobTitle"
    },

    status: {
      type: String,
      enum: ["VACANT", "FILLED", "ACTIVE"],
      default: "VACANT"
    },

    // ─── Resource Allocation Details ──────────────────────────────────────────
    phase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectPhase"
    },

    startDate: Date,
    endDate: Date,

    allocationPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },

    notes: String,

    estimatedCost: {
      type: Number,
      default: 0
    },

    actualCost: {
      type: Number,
      default: 0
    }
    // ─────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

// Compound index for finding members by user (and optionally by project)
projectMemberSchema.index({ user: 1, project: 1 });

export default mongoose.model("ProjectMember", projectMemberSchema);
