import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true
    },

    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true
    },

    quantity: {
      type: Number,
      default: 0
    },

    lastUpdated: Date
  },
  { timestamps: true }
);

// Ensure unique material per warehouse (not globally unique anymore)
inventorySchema.index({ warehouse: 1, material: 1 }, { unique: true });

export default mongoose.model("Inventory", inventorySchema);
