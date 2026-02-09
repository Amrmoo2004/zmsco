import { asynchandler } from "../../utils/response/response.js";
import { comparehash, generatehash } from "../../utils/hash.js";
import UserModel from "../../db/models/user.js";
import RoleModel from "../../db/models/roles.js";
// import { destroyFile } from "../utilities/cloudinary/cloudinary.js";
import { decrypt } from "../../utils/dec.js";
import { encrypt } from "../../utils/enc.js";
import fs from 'fs';

export const update_userrole = asynchandler(async (req, res, next) => {
  const { role } = req.body;

  if (!role) {
    return next(new Error("Role is required", { cause: 400 }));
  }

  const user = await UserModel.findById(req.params.id);
  ;
  if (!user) {
    return next(new Error("User not found", { cause: 404 }));
  }

  const roleDoc = await RoleModel.findOne({
    name: role,
    isActive: true
  });

  if (!roleDoc) {
    return next(new Error("Invalid role name", { cause: 400 }));
  }

  user.role = roleDoc._id;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "User role updated successfully"
  });
});
export const get_users = asynchandler(async (req, res, next) => {
  const { role } = req.query;
  const query = {};

  if (role) {
    // Find role ID first
    const roleDoc = await RoleModel.findOne({ name: { $regex: new RegExp(role, "i") } });
    if (roleDoc) {
      query.role = roleDoc._id;
    } else {
      // If role name not found, return empty or handle as valid but empty result
      // For now, let's return empty if role doesn't exist
      return res.status(200).json({ success: true, data: [] });
    }
  }

  const users = await UserModel.find(query).lean().populate("role", "name");

  if (!users || users.length === 0) {
    return next(new Error('Users not found', { cause: 404 }));
  }

  const usersWithDecryptedPhones = users.map(user => {
    // Create a copy of the user object
    const userCopy = { ...user };

    if (userCopy.phone) {
      userCopy.phone = decrypt(userCopy.phone);
    }

    return userCopy;
  });

  return res.status(200).json({
    success: true,
    data: usersWithDecryptedPhones
  });
});
export const deleteuser = asynchandler(async (req, res, next) => {
  const user = await UserModel.findByIdAndDelete(req.params.id || req.query.id);

  if (!user) {
    return next(new Error('User not found', { cause: 404 }));
  }

  //   if (user.picture?.public_id) {
  //     await destroyFile(user.picture.public_id);
  //   }

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
})
export const getProfile = asynchandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id).populate("role", "name")

    .select('-password -__v -createdAt -updatedAt -forgotPasswordOtp -otpExpires');

  if (!user) {
    throw new Error('User not found', { cause: 404 });
  }

  if (user.phone) {
    user.phone = decrypt(user.phone);
  }

  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,

    }
  });
});
export const updatepassword = asynchandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new Error("All fields are required", { cause: 400 }));
  }
  if (newPassword !== confirmPassword) {
    return next(new Error("New password and confirm password do not match", { cause: 400 }));
  }
  const user = await UserModel.findById(req.user._id)
    .select('+password +tokenVersion');

  if (!await comparehash(oldPassword, user.password)) {
    return next(new Error("Invalid current password", { cause: 400 }));
  }

  user.password = await generatehash({ plaintext: newPassword });
  user.tokenVersion += 1;
  await user.save();

  return res.json({
    success: true,
    requiresReauth: true,
    message: "Password updated. Please login again."
  });
});
export const get_member_profile = asynchandler(async (req, res, next) => {
  const user = await UserModel.findById(req.params.id)
    .select('-password -__v -createdAt -updatedAt -forgotPasswordOtp -otpExpires')
    .populate('role', 'name');

  if (!user) {
    return next(new Error('User not found', { cause: 404 }));
  }
  if (user.phone) {
    user.phone = decrypt(user.phone);
  }
  return res.status(200).json({
    success: true,
    data: user
  });
});
export const get_usercount = asynchandler(async (req, res, next) => {
  const result = await UserModel.aggregate([
    {
      $match: { isActive: true }
    },

    // نربط role
    {
      $lookup: {
        from: "roles",
        localField: "role",
        foreignField: "_id",
        as: "role"
      }
    },

    { $unwind: "$role" },

    // نجمع حسب اسم الرول
    {
      $group: {
        _id: "$role.name",
        count: { $sum: 1 }
      }
    },

    // ترتيب (اختياري)
    {
      $sort: { count: -1 }
    }
  ]);

  // نحولها لشكل أنضف للـ frontend
  const formatted = {};

  result.forEach(item => {
    formatted[item._id] = item.count;
  });

  return res.status(200).json({
    success: true,
    data: formatted
  });
});
