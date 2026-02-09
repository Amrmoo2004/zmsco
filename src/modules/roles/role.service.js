import Role from "../../db/models/roles.js";
import User from "../../db/models/user.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all roles
 */
export const getAllRoles = asynchandler(async (req, res, next) => {
    const roles = await Role.find().sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: roles
    });
});

/**
 * Get role by ID
 */
export const getRoleById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
        return next(new AppError("Role not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: role
    });
});

/**
 * Create new role
 */
export const createRole = asynchandler(async (req, res, next) => {
    const { name, description, permissions } = req.body;

    // Check if role with same name exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
        return next(new AppError("Role with this name already exists", 400));
    }

    const role = await Role.create({
        name,
        description,
        permissions
    });

    return res.status(201).json({
        success: true,
        message: "Role created successfully",
        data: role
    });
});

/**
 * Update role
 */
export const updateRole = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await Role.findById(id);

    if (!role) {
        return next(new AppError("Role not found", 404));
    }

    // Check if new name conflicts
    if (name && name !== role.name) {
        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return next(new AppError("Role with this name already exists", 400));
        }
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;

    await role.save();

    return res.status(200).json({
        success: true,
        message: "Role updated successfully",
        data: role
    });
});

/**
 * Delete role
 */
export const deleteRole = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
        return next(new AppError("Role not found", 404));
    }

    // Check if role is assigned to any users
    const userCount = await User.countDocuments({ role: id });
    if (userCount > 0) {
        return next(new AppError("Cannot delete role that is assigned to users", 400));
    }

    await role.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Role deleted successfully"
    });
});
