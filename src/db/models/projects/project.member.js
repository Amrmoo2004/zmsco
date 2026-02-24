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

    // صلاحيات السيستم
    systemRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true
    },

    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    status: {
      type: String,
      enum: ["VACANT", "FILLED"],
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

    notes: String
    // ─────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

export default mongoose.model("ProjectMember", projectMemberSchema);
