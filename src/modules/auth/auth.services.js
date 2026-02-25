

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../db/models/user.js";
import Role from "../../db/models/roles.js";
import { generateToken } from "../../utils/token.js";
import { asynchandler } from "../../utils/response/response.js";
import { generatehash } from "../../utils/hash.js";
import { successResponse } from "../../utils/response/response.js";
import { encrypt } from "../../utils/enc.js";
import { AppError } from "../../utils/appError.js";
import { emailevnt } from "../../utils/events/email.events.js";
import { comparehash } from "../../utils/hash.js";
import BlacklistToken from "../../db/models/blacklist.model.js";





export const register = asynchandler(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  // Always assign the default user role during registration
  const role = await Role.findOne({ isDefault: true, isActive: true });

  if (!role) {
    throw new AppError("Role not found", 404);
  }

  const user = await User.create({
    name,
    email,
    password: await generatehash({
      plaintext: password,
      saltround: process.env.SALTROUNDS,
    }),
    phone: await encrypt(phone, process.env.encryption_key),
    role: role._id,
    createdBy: req.user ? req.user._id : undefined, // مين اللي أنشأه
  });

  return successResponse(res, {
    message: "User registered successfully",
    userId: user._id,
  }, 201);
});

export const login = asynchandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email })
    .select("+password")
    .populate("role");

  if (!user || !user.isActive) {
    throw new Error("Invalid credentials");
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken({
    userId: user._id,
    roleId: user.role._id
  });

  return res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      role: user.role.name
    }
  });
});

export const sendForgotPassword = asynchandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const user = await User.findOneAndUpdate(
    {
      email: email.toLowerCase().trim(),
      deletedAt: { $exists: false }
    },
    {
      $set: {
        forgotPasswordOtp: await generatehash({ plaintext: otp, saltround: process.env.SALTROUNDS }),
        otpExpires: new Date(Date.now() + 900000) // 15 minutes
      },
      $inc: { otpAttempts: 1 }
    },
    {
      new: true,
      runValidators: true,
      lean: true,
      select: '-password -__v -tokens'
    }
  );

  if (!user) {
    return next(new Error("No active local user found with this email", { cause: 404 }));
  }

  emailevnt.emit("forgotpassword", {
    to: user.email,
    subject: "Password Reset OTP",
    otp: otp,
    expiresIn: "15 minutes"
  });

  return successResponse(res, {
    success: true,
    message: "Password reset OTP sent successfully!",
    data: {
      email: user.email,
      otpExpiresIn: "15 minutes"
    }
  });
});
export const verifyOtp = asynchandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();
  const { otp } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new Error("No account found with this email", { cause: 404 }));
  }

  if (!user.forgotPasswordOtp || !user.otpExpires) {
    return next(
      new Error("No password reset request found", { cause: 400 })
    );
  }

  if (user.otpExpires < new Date()) {
    return next(
      new Error("OTP has expired. Please request a new one", { cause: 400 })
    );
  }

  const isOtpValid = await comparehash(otp, user.forgotPasswordOtp);
  if (!isOtpValid) {
    return next(new Error("Invalid OTP", { cause: 400 }));
  }

  user.isOtpVerified = true;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "OTP is valid"
  });
});

export const verifyPassword = asynchandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();
  const { password, confirmPassword } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new Error("No account found with this email", { cause: 404 }));
  }

  if (!user.isOtpVerified) {
    return next(new Error("Please verify OTP first", { cause: 400 }));
  }

  if (!user.otpExpires || user.otpExpires < new Date()) {
    user.isOtpVerified = false;
    await user.save();
    return next(
      new Error("Password reset session has expired. Please request a new OTP", { cause: 400 })
    );
  }

  if (password !== confirmPassword) {
    return next(new Error("Passwords do not match", { cause: 400 }));
  }

  user.password = await generatehash({ plaintext: password });
  user.forgotPasswordOtp = undefined;
  user.otpExpires = undefined;
  user.isOtpVerified = false;

  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password updated successfully"
  });
});
export const changePassword = asynchandler(async (req, res, next) => {
  const userId = req.user._id;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  const user = await User.findById(userId).select("+password");
  if (!user) {
    return next(new Error("User not found", { cause: 404 }));
  }
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return next(new Error("Current password is incorrect", { cause: 400 }));
  }
  if (newPassword !== confirmNewPassword) {
    return next(new Error("New passwords do not match", { cause: 400 }));
  }
  user.password = await generatehash({ plaintext: newPassword, saltround: process.env.SALTROUNDS });
  await user.save();
  return res.status(200).json({
    success: true,
    message: "Password changed successfully"
  });
});

export const logout = asynchandler(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    // Decode token to get expiration time
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Save to blacklist
    await BlacklistToken.create({
      token,
      expiresAt: new Date(decoded.exp * 1000)
    });
  }

  return res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
});

export const get_roles = asynchandler(async (req, res, next) => {
  const roles = await Role.find({ isActive: true }).select("name description");
  return res.status(200).json({ success: true, data: roles });
});