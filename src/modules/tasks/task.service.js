
import ProjectPhase from "../../db/models/projects/project.phase.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import Attachment from "../../db/models/attachment.model.js";
import { uploadFile } from "../attachments/attachment.service.js";
import { deleteFromCloudinary } from "../../utils/cloudinary.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitDashboardUpdate } from "../../utils/socket.js";
import { tryAutoCompletePhase } from "../../utils/phaseUtils.js";

// GET /api/projects/:projectId/phases/:phaseId/tasks
export const getTasksByPhase = asynchandler(async (req, res) => {
    const { phaseId } = req.params;
    const phase = await ProjectPhase.findById(phaseId)
        .populate("tasks.assignedTo", "name email")
        .populate("tasks.attachments");
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found" });
    
    // Sort tasks descending by createdAt
    const tasks = phase.tasks.sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ success: true, data: tasks });
});

// POST /api/projects/:projectId/phases/:phaseId/tasks
export const createTask = asynchandler(async (req, res, next) => {
    const { projectId, phaseId } = req.params;
    const { name, description, assignedTo, priority, dueDate } = req.body;
    
    // ── Validate phase belongs to this project ──
    const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    phase.tasks.push({ name, description, assignedTo, priority, dueDate });
    await phase.save();

    const task = phase.tasks[phase.tasks.length - 1];

    // Notify the assigned user
    if (assignedTo) {
        await createNotification(
            assignedTo,
            "تم تعيينك في مهمة جديدة",
            `تم إسناد مهمة "${name}" إليك في مرحلة ${phase.nameAr || phase.name || 'جديدة'}.`,
            "INFO",
            { taskId: task._id, phaseId: phase._id }
        );
    }

    return res.status(201).json({ success: true, message: "Task created successfully", data: task });
});

// PUT /api/projects/:projectId/phases/:phaseId/tasks/:taskId
export const updateTask = asynchandler(async (req, res, next) => {
    const { projectId, phaseId, taskId } = req.params;
    
    // ── Validate phase belongs to this project ──
    const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const task = phase.tasks.id(taskId);
    if (!task) return next(new AppError("Task not found", 404));

    const oldAssignedTo = task.assignedTo?.toString();
    Object.assign(task, req.body);

    // If task is now completed, record completedAt
    if (req.body.status === "COMPLETED" && !task.completedAt) {
        task.completedAt = new Date();
    }

    await phase.save();

    // 🔄 Check if phase should auto-complete after task status change
    await tryAutoCompletePhase(phase, {
        emitToProject, emitDashboardUpdate, createNotification,
        ProjectMember, Project
    });

    // Notify if a NEW user was assigned to this task during update
    if (req.body.assignedTo && req.body.assignedTo.toString() !== oldAssignedTo) {
        await createNotification(
            req.body.assignedTo,
            "تم تعيينك في مهمة",
            `تم إسناد مهمة "${task.name}" إليك في مرحلة ${phase.nameAr || phase.name || 'حالية'}.`,
            "INFO",
            { taskId: task._id, phaseId: phase._id }
        );
    }

    return res.status(200).json({ success: true, message: "Task updated successfully", data: task });
});

// DELETE /api/projects/:projectId/phases/:phaseId/tasks/:taskId
export const deleteTask = asynchandler(async (req, res, next) => {
    const { projectId, phaseId, taskId } = req.params;
    
    // ── Validate phase belongs to this project ──
    const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const task = phase.tasks.id(taskId);
    if (!task) return next(new AppError("Task not found", 404));

    phase.tasks.pull(taskId);
    await phase.save();

    return res.status(200).json({ success: true, message: "Task deleted successfully" });
});

// POST /api/projects/:projectId/phases/:phaseId/approve-requirement
export const submitPhaseAttachment = asynchandler(async (req, res, next) => {
    const { phaseId } = req.params;
    const { documentType, attachmentId, isMandatory } = req.body;

    if (!documentType || !attachmentId) {
        return next(new AppError("documentType و attachmentId مطلوبان", 400));
    }

    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) return next(new AppError("Phase not found", 404));

    let reqDoc = phase.requiredAttachments.find(a => a.documentType === documentType);

    if (!reqDoc) {
        // لو مفيش slot مسبق → ننشئه تلقائياً (مرفق اختياري)
        phase.requiredAttachments.push({
            documentType,
            attachmentId,
            reviewStatus: "PENDING",
            isMandatory: isMandatory ?? false
        });
    } else {
        // slot موجود → نحدّثه
        reqDoc.attachmentId = attachmentId;
        reqDoc.reviewStatus = "PENDING";
    }

    await phase.save();
    return res.status(200).json({ success: true, message: "Document submitted for review", data: phase });
});

// PUT /api/projects/:projectId/phases/:phaseId/review-attachment/:attachmentSlotId
export const reviewPhaseAttachment = asynchandler(async (req, res, next) => {
    const { phaseId, attachmentSlotId } = req.params;
    const { status, rejectionReason } = req.body;

    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) return next(new AppError("Phase not found", 404));

    const slot = phase.requiredAttachments.id(attachmentSlotId);
    if (!slot) return next(new AppError("Attachment slot not found", 404));

    slot.reviewStatus = status;
    if (status === "REJECTED") slot.rejectionReason = rejectionReason;
    await phase.save();

    // 🔄 Check if phase should auto-complete after attachment review
    await tryAutoCompletePhase(phase, {
        emitToProject, emitDashboardUpdate, createNotification,
        ProjectMember, Project
    });

    return res.status(200).json({ success: true, message: "Attachment review updated", data: phase });
});

// PUT /api/projects/:projectId/phases/:phaseId/sign-off
export const signOffPhase = asynchandler(async (req, res, next) => {
    const { phaseId } = req.params;
    const userId = req.user._id;
    const { status, notes } = req.body;

    const phase = await ProjectPhase.findById(phaseId).populate("requiredApprovals.role");
    if (!phase) return next(new AppError("Phase not found", 404));

    // Find the approval slot for this user
    const approvalSlot = phase.requiredApprovals.find(a => a.user?.toString() === userId.toString() && a.status === "PENDING");
    if (!approvalSlot) return next(new AppError("No pending approval found for this user on this phase", 404));

    approvalSlot.status = status;
    approvalSlot.actionDate = new Date();
    approvalSlot.notes = notes;
    await phase.save();

    // 🔄 Check if phase should auto-complete after sign-off
    await tryAutoCompletePhase(phase, {
        emitToProject, emitDashboardUpdate, createNotification,
        ProjectMember, Project
    });

    return res.status(200).json({ success: true, message: `Phase sign-off ${status.toLowerCase()}`, data: phase });
});

// POST /api/projects/:projectId/phases/:phaseId/tasks/:taskId/attachments
export const uploadTaskAttachment = asynchandler(async (req, res, next) => {
    const { projectId, phaseId, taskId } = req.params;
    
    if (!req.file) {
        return next(new AppError("No file uploaded. Use field name 'file'", 400));
    }

    const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const task = phase.tasks.id(taskId);
    if (!task) return next(new AppError("Task not found", 404));

    // Permission check: User must be assignee, OR have EDIT_PROJECT permission, OR be admin (*)
    const isAssignee = task.assignedTo?.toString() === req.user._id.toString();
    const hasProjectPermission = req.user.permissions?.includes("EDIT_PROJECT") || req.user.permissions?.includes("*");

    if (!isAssignee && !hasProjectPermission) {
        return next(new AppError("Permission denied: You can only upload attachments to your assigned tasks", 403));
    }

    // Upload the file using general upload service
    const attachment = await uploadFile(req.file, req.user._id, {
        refModel: "ProjectPhase", // referencing ProjectPhase because tasks are embedded inside it
        refId: phase._id
    });

    // Add to task attachments
    if (!task.attachments) {
        task.attachments = [];
    }
    task.attachments.push(attachment._id);
    await phase.save();

    return res.status(201).json({
        success: true,
        message: "Attachment uploaded and added to task successfully",
        data: attachment
    });
});

// DELETE /api/projects/:projectId/phases/:phaseId/tasks/:taskId/attachments/:attachmentId
export const deleteTaskAttachment = asynchandler(async (req, res, next) => {
    const { projectId, phaseId, taskId, attachmentId } = req.params;

    const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const task = phase.tasks.id(taskId);
    if (!task) return next(new AppError("Task not found", 404));

    // Permission check: User must be assignee, OR have EDIT_PROJECT / DELETE_PROJECT permission, OR be admin (*)
    const isAssignee = task.assignedTo?.toString() === req.user._id.toString();
    const hasProjectPermission = req.user.permissions?.includes("EDIT_PROJECT") || req.user.permissions?.includes("DELETE_PROJECT") || req.user.permissions?.includes("*");

    if (!isAssignee && !hasProjectPermission) {
        return next(new AppError("Permission denied: You can only delete attachments from your assigned tasks", 403));
    }

    // Check if attachment is linked to this task
    if (!task.attachments || !task.attachments.includes(attachmentId)) {
        return next(new AppError("Attachment not found in this task", 404));
    }

    // Remove from task's attachments array
    task.attachments.pull(attachmentId);
    await phase.save();

    // Delete the attachment record and Cloudinary file
    const attachment = await Attachment.findById(attachmentId);
    if (attachment) {
        const resourceType = attachment.mimeType.startsWith('image/') ? 'image'
            : attachment.mimeType.startsWith('video/') ? 'video'
                : 'raw';
        await deleteFromCloudinary(attachment.publicId, resourceType);
        await attachment.deleteOne();
    }

    return res.status(200).json({
        success: true,
        message: "Attachment deleted from task successfully"
    });
});
