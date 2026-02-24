import PhaseApproval from "../../db/models/projects/phaseApproval.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/projects/:projectId/phases/:phaseId/approvals
export const getPhaseApprovals = asynchandler(async (req, res) => {
    const { phaseId } = req.params;
    const approvals = await PhaseApproval.find({ phase: phaseId })
        .populate("processedBy", "name email")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: approvals });
});

// POST /api/projects/:projectId/phases/:phaseId/approvals
export const createPhaseApproval = asynchandler(async (req, res) => {
    const { projectId, phaseId } = req.params;
    const { approvalType, referenceModel, referenceId } = req.body;
    const approval = await PhaseApproval.create({
        project: projectId, phase: phaseId,
        approvalType, referenceModel, referenceId
    });
    return res.status(201).json({ success: true, message: "Phase approval created", data: approval });
});

// PUT /api/projects/:projectId/phases/:phaseId/approvals/:approvalId
export const processPhaseApproval = asynchandler(async (req, res, next) => {
    const { approvalId } = req.params;
    const { status, notes } = req.body;
    const approval = await PhaseApproval.findById(approvalId);
    if (!approval) return next(new AppError("Phase approval not found", 404));

    approval.status = status;
    approval.notes = notes;
    approval.processedBy = req.user._id;
    approval.processedAt = new Date();
    await approval.save();

    return res.status(200).json({ success: true, message: "Phase approval processed", data: approval });
});
