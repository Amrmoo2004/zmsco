import ProjectPhaseModel from "../db/models/projects/project.phase.js";

/**
 * Auto-complete a phase if ALL requirements are met:
 *   - All tasks COMPLETED
 *   - All required attachments uploaded
 *   - All required approvals APPROVED
 *   - All mandatory permits have a permitNumber
 *
 * If completed → also unlocks the next phase (PENDING → IN_PROGRESS).
 *
 * @param {Document} phase  — Mongoose document (not lean)
 * @param {Object}   opts   — { emitToProject, emitDashboardUpdate, createNotification, ProjectMember, Project }
 * @returns {boolean} true if the phase was auto-completed
 */
export const tryAutoCompletePhase = async (phase, opts = {}) => {
    if (phase.status === "COMPLETED") return false;

    const stats = calculatePhaseStatistics(phase);
    if (!stats.canComplete) return false;

    // Check mandatory permits too
    const mandatoryPermits = (phase.requiredPermits || []).filter(p => p.isMandatory);
    const allPermitsDone = mandatoryPermits.every(p => !!p.permitNumber);
    if (!allPermitsDone) return false;

    // ✅ Mark phase as COMPLETED
    phase.status = "COMPLETED";
    await phase.save();

    const projectId = phase.project.toString();

    // 🔔 Emit phase completion events
    if (opts.emitToProject) {
        opts.emitToProject(projectId, 'phase:updated', {
            type: 'UPDATED',
            phaseId: phase._id,
            phaseName: phase.name,
            projectId,
            status: "COMPLETED",
            prevStatus: "IN_PROGRESS",
            timestamp: new Date().toISOString(),
        });

        opts.emitToProject(projectId, 'notification:phase_completed', {
            phaseId: phase._id,
            phaseName: phase.name,
            projectId,
            completedAt: new Date().toISOString(),
        });
    }

    if (opts.emitDashboardUpdate) {
        opts.emitDashboardUpdate({ trigger: 'phase_completed', projectId, phaseId: phase._id });
    }

    // 🔔 Notify project members
    if (opts.createNotification && opts.ProjectMember && opts.Project) {
        const project = await opts.Project.findById(projectId);
        const members = await opts.ProjectMember.find({ project: projectId }).select("user");
        await Promise.all(
            members.map(m =>
                opts.createNotification(
                    m.user,
                    `✅ مرحلة "${phase.name}" اكتملت`,
                    `تم الانتهاء من مرحلة "${phase.name}" في مشروع "${project?.name}".`,
                    'SUCCESS',
                    { projectId, phaseId: phase._id }
                ).catch(() => { })
            )
        );
    }

    // 🔓 Unlock the next phase
    const nextPhase = await ProjectPhaseModel.findOne({
        project: projectId,
        order: { $gt: phase.order }
    }).sort({ order: 1 });

    if (nextPhase && nextPhase.status === "PENDING") {
        nextPhase.status = "IN_PROGRESS";
        await nextPhase.save();

        if (opts.emitToProject) {
            opts.emitToProject(projectId, 'phase:updated', {
                type: 'UPDATED',
                phaseId: nextPhase._id,
                phaseName: nextPhase.name,
                projectId,
                status: "IN_PROGRESS",
                prevStatus: "PENDING",
                timestamp: new Date().toISOString(),
            });
        }
    }

    return true;
};

export const calculatePhaseStatistics = (phase) => {
    // Determine if phase is a Mongoose document or plain object
    const pObj = phase.toObject ? phase.toObject() : phase;

    const totalTasks = (pObj.tasks || []).length;
    const completedTasks = (pObj.tasks || []).filter(t => t.status === 'COMPLETED').length;
    
    const totalAttachments = (pObj.requiredAttachments || []).length;
    const uploadedAttachments = (pObj.requiredAttachments || []).filter(a => !!a.attachmentId).length;
    
    const totalApprovals = (pObj.requiredApprovals || []).length;
    const approvedApprovals = (pObj.requiredApprovals || []).filter(a => a.status === 'APPROVED').length;
    
    const taskPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : (pObj.status === 'COMPLETED' ? 100 : 0);
    const attachPct = totalAttachments > 0 ? (uploadedAttachments / totalAttachments) * 100 : 100;
    const approvalPct = totalApprovals > 0 ? (approvedApprovals / totalApprovals) * 100 : 100;
    const progress = Math.round(taskPct * 0.6 + attachPct * 0.2 + approvalPct * 0.2);
    
    const canComplete = completedTasks === totalTasks && uploadedAttachments === totalAttachments && approvedApprovals === totalApprovals;
    
    return {
        progress,
        canComplete,
        tasks: { completed: completedTasks, total: totalTasks },
        attachments: { uploaded: uploadedAttachments, total: totalAttachments },
        approvals: { approved: approvedApprovals, total: totalApprovals }
    };
};
