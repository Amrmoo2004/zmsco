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
    forgotPasswordOtp:{
      type: String,
default:null

  },
        
    tokenVersion: {
    type: Number,
    default: 0,
    required: true
  },
    
    otp: String,
    otpExpires: Date
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
