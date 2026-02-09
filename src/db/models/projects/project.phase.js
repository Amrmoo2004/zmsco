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
    }
  },
  { timestamps: true }
);

export default mongoose.model("ProjectPhase", projectPhaseSchema);
