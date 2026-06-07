import PhaseApproval from "../../db/models/projects/phaseApproval.model.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitDashboardUpdate } from "../../utils/socket.js";
import { tryAutoCompletePhase } from "../../utils/phaseUtils.js";

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

/**
 * PUT /api/projects/:projectId/phases/:phaseId/approvals/:approvalId
 * Process (approve/reject) a phase approval AND sync back to phase.requiredApprovals[]
 * so that get_phase_details correctly reflects the approval state.
 *
 * Body: { status: "APPROVED"|"REJECTED", notes?: string, slotId?: string }
 *   slotId — optional ObjectId of the requiredApprovals subdoc inside the phase.
 *            If omitted, the first PENDING slot is updated.
 */
export const processPhaseApproval = asynchandler(async (req, res, next) => {
    const { phaseId, approvalId } = req.params;
    const { status, notes, slotId } = req.body;

    // 1. Update the standalone PhaseApproval record
    const approval = await PhaseApproval.findById(approvalId);
    if (!approval) return next(new AppError("Phase approval not found", 404));

    approval.status = status;
    approval.notes = notes;
    approval.processedBy = req.user._id;
    approval.processedAt = new Date();
    await approval.save();

    // 2. Sync back into phase.requiredApprovals[] so statistics stay accurate
    const phase = await ProjectPhase.findById(phaseId);
    if (phase && phase.requiredApprovals && phase.requiredApprovals.length > 0) {
        let slot;
        if (slotId) {
            // Caller told us exactly which slot to update
            slot = phase.requiredApprovals.id(slotId);
        } else {
            // Auto-match: find the first PENDING slot whose role matches the approval type
            slot = phase.requiredApprovals.find(
                s => s.status === "PENDING"
            );
        }

        if (slot) {
            slot.status = status;
            slot.user = req.user._id;
            slot.actionDate = new Date();
            slot.notes = notes;
            await phase.save();

            // 🔄 Check if phase should auto-complete after approval
            await tryAutoCompletePhase(phase, {
                emitToProject, emitDashboardUpdate, createNotification,
                ProjectMember, Project
            });
        }
    }

    return res.status(200).json({ success: true, message: "Phase approval processed", data: approval });
});
