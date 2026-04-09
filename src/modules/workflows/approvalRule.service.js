import ApprovalRule from "../../db/models/settings/approvalRule.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getAllRules = asynchandler(async (req, res) => {
    const rules = await ApprovalRule.find()
        .populate({
            path: 'workflow',
            populate: [
                { path: 'steps.role', select: 'name' },
                { path: 'steps.user', select: 'name email' }
            ]
        })
        .sort({ entityType: 1, 'condition.isAlways': 1, 'condition.minAmount': 1 });
    return res.status(200).json({ success: true, data: rules });
});

export const getRuleById = asynchandler(async (req, res, next) => {
    const rule = await ApprovalRule.findById(req.params.id)
        .populate({
            path: 'workflow',
            populate: [
                { path: 'steps.role', select: 'name' },
                { path: 'steps.user', select: 'name email' }
            ]
        });
    if (!rule) return next(new AppError("Approval Rule not found", 404));
    return res.status(200).json({ success: true, data: rule });
});

export const createRule = asynchandler(async (req, res, next) => {
    const { entityType, description, condition, workflow } = req.body;
    const rule = await ApprovalRule.create({ entityType, description, condition, workflow });
    return res.status(201).json({ success: true, message: "Approval Rule created successfully", data: rule });
});

export const updateRule = asynchandler(async (req, res, next) => {
    const rule = await ApprovalRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!rule) return next(new AppError("Approval Rule not found", 404));
    return res.status(200).json({ success: true, message: "Approval Rule updated successfully", data: rule });
});

export const deleteRule = asynchandler(async (req, res, next) => {
    const rule = await ApprovalRule.findByIdAndDelete(req.params.id);
    if (!rule) return next(new AppError("Approval Rule not found", 404));
    return res.status(200).json({ success: true, message: "Approval Rule deleted successfully" });
});
