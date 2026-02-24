import Task from "../../db/models/projects/task.model.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/projects/:projectId/phases/:phaseId/tasks
export const getTasksByPhase = asynchandler(async (req, res) => {
    const { phaseId } = req.params;
    const tasks = await Task.find({ phase: phaseId })
        .populate("assignedTo", "name email")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: tasks });
});

// POST /api/projects/:projectId/phases/:phaseId/tasks
export const createTask = asynchandler(async (req, res, next) => {
    const { projectId, phaseId } = req.params;
    const { name, description, assignedTo, priority, dueDate } = req.body;
    const task = await Task.create({
        project: projectId,
        phase: phaseId,
        name, description, assignedTo, priority, dueDate
    });
    return res.status(201).json({ success: true, message: "Task created successfully", data: task });
});

// PUT /api/projects/:projectId/phases/:phaseId/tasks/:taskId
export const updateTask = asynchandler(async (req, res, next) => {
    const task = await Task.findByIdAndUpdate(req.params.taskId, req.body, { new: true, runValidators: true });
    if (!task) return next(new AppError("Task not found", 404));
    // If task is now completed, record completedAt
    if (req.body.status === "COMPLETED" && !task.completedAt) {
        task.completedAt = new Date();
        await task.save();
    }
    return res.status(200).json({ success: true, message: "Task updated successfully", data: task });
});

// DELETE /api/projects/:projectId/phases/:phaseId/tasks/:taskId
export const deleteTask = asynchandler(async (req, res, next) => {
    const task = await Task.findByIdAndDelete(req.params.taskId);
    if (!task) return next(new AppError("Task not found", 404));
    return res.status(200).json({ success: true, message: "Task deleted successfully" });
});

// POST /api/projects/:projectId/phases/:phaseId/approve-requirement  
export const submitPhaseAttachment = asynchandler(async (req, res, next) => {
    const { phaseId } = req.params;
    const { documentType, attachmentId } = req.body;

    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) return next(new AppError("Phase not found", 404));

    const reqDoc = phase.requiredAttachments.find(a => a.documentType === documentType);
    if (!reqDoc) return next(new AppError("Document type not found in required attachments", 404));

    reqDoc.attachmentId = attachmentId;
    reqDoc.reviewStatus = "PENDING";
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

    return res.status(200).json({ success: true, message: `Phase sign-off ${status.toLowerCase()}`, data: phase });
});
