import ProjectMember from "../../db/models/projects/project.member.js";
import Project from "../../db/models/projects/project.js";
import User from "../../db/models/user.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get project members
 */
export const getProjectMembers = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const members = await ProjectMember.find({ project: projectId })
        .populate("user", "name email")
        .sort({ joinedAt: -1 });

    return res.status(200).json({
        success: true,
        data: members
    });
});

/**
 * Add member to project
 */
export const addProjectMember = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { user, role } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const userExists = await User.findById(user);
    if (!userExists) {
        return next(new AppError("User not found", 404));
    }

    // Check if user is already a member
    const existingMember = await ProjectMember.findOne({ project: projectId, user });
    if (existingMember) {
        return next(new AppError("User is already a member of this project", 400));
    }

    const member = await ProjectMember.create({
        project: projectId,
        user,
        role
    });

    await member.populate("user", "name email");

    return res.status(201).json({
        success: true,
        message: "Member added to project successfully",
        data: member
    });
});

/**
 * Update member role
 */
export const updateProjectMember = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const { role } = req.body;

    const member = await ProjectMember.findOne({ _id: id, project: projectId });

    if (!member) {
        return next(new AppError("Member not found in this project", 404));
    }

    if (role) member.role = role;

    await member.save();
    await member.populate("user", "name email");

    return res.status(200).json({
        success: true,
        message: "Member role updated successfully",
        data: member
    });
});

/**
 * Remove member from project
 */
export const removeProjectMember = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const member = await ProjectMember.findOne({ _id: id, project: projectId });

    if (!member) {
        return next(new AppError("Member not found in this project", 404));
    }

    await member.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Member removed from project successfully"
    });
});
