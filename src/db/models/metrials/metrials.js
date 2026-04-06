import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialCategory",
      required: true
    },

    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeasurementUnit",
      required: true
    },

    alertQuantity: {
      type: Number,
      default: 0
    },

    suppliers: [
      {
        supplier: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supplier"
        },
        price: Number
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Material", materialSchema);
