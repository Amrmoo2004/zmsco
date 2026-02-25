import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    phone: String,

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },
    forgotPasswordOtp: {
      type: String,
      default: null
    },
    isOtpVerified: {
      type: Boolean,
      default: false
    },

    tokenVersion: {
      type: Number,
      default: 0,
      required: true
    },

    // --- New HR / Resource Allocation Fields ---
    jobTitle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobTitle"
    },

    hourlyRate: {
      type: Number,
      default: 0
    },

    status: {
      type: String,
      enum: ["AVAILABLE", "BUSY", "ON_LEAVE"],
      default: "AVAILABLE"
    },

    skills: [{
      type: String
    }],

    joinDate: {
      type: Date
    },

    performanceRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    // ------------------------------------------

    otp: String,
    otpExpires: Date
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
