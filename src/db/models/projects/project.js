import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      unique: true,
      uppercase: true
    },

    type: {
      type: String,
      enum: [
        "INFRASTRUCTURE",
        "TECHNOLOGY",
        "MAINTENANCE",
        "TRANSFORMATION"
      ]
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM"
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "PLANNING",
        "EXECUTION",
        "ON_HOLD",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "DRAFT"
    },

    startDate: Date,
    endDate: Date,

    department: {
      type: String
    },
    budget: {
      type: Number,
      default: 0
    },

    client: {
      type: String
    },

    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // Warehouse Configuration
    warehouseType: {
      type: String,
      enum: ["SHARED", "DEDICATED"],
      default: "SHARED"
    },

    dedicatedWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse"
    },

    description: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Project", projectSchema);
