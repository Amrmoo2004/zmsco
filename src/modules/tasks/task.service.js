
import ProjectPhase from "../../db/models/projects/project.phase.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/projects/:projectId/phases/:phaseId/tasks
export const getTasksByPhase = asynchandler(async (req, res) => {
    const { phaseId } = req.params;
    const phase = await ProjectPhase.findById(phaseId).populate("tasks.assignedTo", "name email");
    if (!phase) return res.status(404).json({ success: false, message: "Phase not found" });
    
    // Sort tasks descending by createdAt
    const tasks = phase.tasks.sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ success: true, data: tasks });
});

// POST /api/projects/:projectId/phases/:phaseId/tasks
export const createTask = asynchandler(async (req, res, next) => {
    const { phaseId } = req.params;
    const { name, description, assignedTo, priority, dueDate } = req.body;
    
    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) return next(new AppError("Phase not found", 404));

    phase.tasks.push({ name, description, assignedTo, priority, dueDate });
    await phase.save();

    const task = phase.tasks[phase.tasks.length - 1];
    return res.status(201).json({ success: true, message: "Task created successfully", data: task });
});

// PUT /api/projects/:projectId/phases/:phaseId/tasks/:taskId
export const updateTask = asynchandler(async (req, res, next) => {
    const { phaseId, taskId } = req.params;
    
    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) return next(new AppError("Phase not found", 404));

    const task = phase.tasks.id(taskId);
    if (!task) return next(new AppError("Task not found", 404));

    Object.assign(task, req.body);

    // If task is now completed, record completedAt
    if (req.body.status === "COMPLETED" && !task.completedAt) {
        task.completedAt = new Date();
    }

    await phase.save();
    return res.status(200).json({ success: true, message: "Task updated successfully", data: task });
});

// DELETE /api/projects/:projectId/phases/:phaseId/tasks/:taskId
export const deleteTask = asynchandler(async (req, res, next) => {
    const { phaseId, taskId } = req.params;
    
    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) return next(new AppError("Phase not found", 404));

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
