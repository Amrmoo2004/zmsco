import ProjectMember from "../../db/models/projects/project.member.js";
import Project from "../../db/models/projects/project.js";
import User from "../../db/models/user.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject } from "../../utils/socket.js";

/** Get project members */
export const getProjectMembers = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    const members = await ProjectMember.find({ project: projectId })
        .populate("user", "name email")
        .sort({ joinedAt: -1 });

    return res.status(200).json({ success: true, data: members });
});

/** Add member to project — notifies the new member */
export const addProjectMember = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { user, role } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    const userExists = await User.findById(user);
    if (!userExists) return next(new AppError("User not found", 404));

    const existingMember = await ProjectMember.findOne({ project: projectId, user });
    if (existingMember) return next(new AppError("User is already a member of this project", 400));

    const member = await ProjectMember.create({ project: projectId, user, role });
    await member.populate("user", "name email");

    // 👤 Notify the newly assigned user
    await createNotification(
        user,
        `👤 تم تعيينك في مشروع`,
        `تم تعيينك كـ "${role}" في مشروع "${project.name}".`,
        'INFO',
        { projectId, role }
    );

    // 🔔 Broadcast to project room (others know a new member joined)
    emitToProject(projectId, 'resource:assigned', {
        type: 'MEMBER_ADDED',
        userId: user,
        userName: userExists.name,
        role,
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: "Member added to project successfully", data: member });
});

/** Update member role */
export const updateProjectMember = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const { role } = req.body;

    const member = await ProjectMember.findOne({ _id: id, project: projectId });
    if (!member) return next(new AppError("Member not found in this project", 404));

    if (role) member.role = role;
    await member.save();
    await member.populate("user", "name email");

    // Notify member of role change
    await createNotification(
        member.user._id,
        `🔄 تم تغيير دورك في المشروع`,
        `تم تحديث دورك إلى "${role}" في المشروع.`,
        'INFO',
        { projectId, role }
    );

    emitToProject(projectId, 'resource:assigned', {
        type: 'ROLE_UPDATED',
        memberId: id,
        newRole: role,
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Member role updated successfully", data: member });
});

/** Remove member from project */
export const removeProjectMember = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const member = await ProjectMember.findOne({ _id: id, project: projectId });
    if (!member) return next(new AppError("Member not found in this project", 404));

    const userId = member.user;
    await member.deleteOne();

    // Notify removed member
    await createNotification(
        userId,
        `🚪 تم إزالتك من مشروع`,
        `تم إزالتك من المشروع.`,
        'WARNING',
        { projectId }
    );

    emitToProject(projectId, 'resource:assigned', {
        type: 'MEMBER_REMOVED',
        userId: String(userId),
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Member removed from project successfully" });
});
