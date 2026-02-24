import Workflow from "../../db/models/settings/workflow.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getAllWorkflows = asynchandler(async (req, res) => {
    const workflows = await Workflow.find().populate("steps.role", "name").populate("steps.user", "name email").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: workflows });
});

export const getWorkflowById = asynchandler(async (req, res, next) => {
    const wf = await Workflow.findById(req.params.id).populate("steps.role", "name").populate("steps.user", "name email");
    if (!wf) return next(new AppError("Workflow not found", 404));
    return res.status(200).json({ success: true, data: wf });
});

export const createWorkflow = asynchandler(async (req, res, next) => {
    const { name, entityType, steps } = req.body;
    const existing = await Workflow.findOne({ name });
    if (existing) return next(new AppError("Workflow with this name already exists", 400));
    const wf = await Workflow.create({ name, entityType, steps });
    return res.status(201).json({ success: true, message: "Workflow created successfully", data: wf });
});

export const updateWorkflow = asynchandler(async (req, res, next) => {
    const wf = await Workflow.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!wf) return next(new AppError("Workflow not found", 404));
    return res.status(200).json({ success: true, message: "Workflow updated successfully", data: wf });
});

export const deleteWorkflow = asynchandler(async (req, res, next) => {
    const wf = await Workflow.findByIdAndDelete(req.params.id);
    if (!wf) return next(new AppError("Workflow not found", 404));
    return res.status(200).json({ success: true, message: "Workflow deleted successfully" });
});
