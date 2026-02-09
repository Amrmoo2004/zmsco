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
      enum: ["ISSUE", "RETURN"],
      required: true
    },

    unitCost: Number,
    totalCost: Number,

    referenceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialRequest"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

export default mongoose.model("MaterialTransaction", materialTransactionSchema);
