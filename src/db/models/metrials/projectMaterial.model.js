import mongoose from "mongoose";

const projectMaterialSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true
    },

    plannedQuantity: {
      type: Number,
      default: 0
    },

    issuedQuantity: {
      type: Number,
      default: 0
    },

    unitCost: Number,

    totalCost: Number
  },
  { timestamps: true }
);

export default mongoose.model("ProjectMaterial", projectMaterialSchema);
