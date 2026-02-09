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
      enum: ["PENDING", "APPROVED", "REJECTED", "ISSUED"],
      default: "PENDING"
    },

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
    }
  },
  { timestamps: true }
);

export default mongoose.model("MaterialRequest", materialRequestSchema);
