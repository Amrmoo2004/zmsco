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
