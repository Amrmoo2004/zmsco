import ProjectPhase from "../../db/models/projects/project.phase.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitDashboardUpdate } from "../../utils/socket.js";
import { calculatePhaseStatistics, tryAutoCompletePhase } from "../../utils/phaseUtils.js";

/** Get project phases */
export const getProjectPhases = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).select("manager").lean();
    if (!project) return next(new AppError("Project not found", 404));

    const userId = req.user._id.toString();
    const isAdmin      = req.user.role === "ADMIN" || req.user.role === "superAdmin";
    const isManager    = project.manager?.toString() === userId;
    const isProjMgr    = req.user.role === "PROJECT_MANAGER"; // system role
    const isPrivileged = isAdmin || isManager || isProjMgr;

    const phasesRaw = await ProjectPhase.find({ project: projectId }).sort({ order: 1 }).lean();

    let phases;

    if (isPrivileged) {
        // Admins & managers → see everything as-is
        phases = phasesRaw.map(p => ({ ...p, statistics: calculatePhaseStatistics(p) }));
    } else {
        // Regular users → only phases they have tasks in, tasks filtered to their own
        phases = phasesRaw
            .map(p => {
                const myTasks = (p.tasks || []).filter(t =>
                    t.assignedTo?.toString() === userId
                );
                if (myTasks.length === 0) return null; // skip phases with no tasks for this user
                return {
                    ...p,
                    tasks: myTasks,
                    statistics: calculatePhaseStatistics({ ...p, tasks: myTasks })
                };
            })
            .filter(Boolean); // remove nulls
    }

    return res.status(200).json({ success: true, data: phases });
});


/** Create project phase */
export const createProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const {
        name, nameAr, nameEn, description,
        startDate, endDate, status,
        color, order, expectedDays, budget, isRequired,
        tasks, requiredAttachments, requiredPermits, requiredApprovals,
        customFields
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    // Auto-assign order if not provided
    const phaseCount = await ProjectPhase.countDocuments({ project: projectId });

    const phase = await ProjectPhase.create({
        project: projectId,
        name: name || nameAr || nameEn || "مرحلة",
        nameAr, nameEn,
        description, startDate, endDate,
        status: status || "IN_PROGRESS",
        color: color || "#10B981",
        order: order ?? phaseCount + 1,
        expectedDays,
        budget: budget || 0,
        isRequired: isRequired ?? true,
        tasks: tasks || [],
        requiredAttachments: requiredAttachments || [],
        requiredPermits: requiredPermits || [],
        requiredApprovals: requiredApprovals || [],
        customFields: customFields || {}
    });

    // 🔔 Broadcast to project room
    emitToProject(projectId, 'phase:updated', {
        type: 'CREATED',
        phaseId: phase._id,
        phaseName: phase.name,
        projectId,
        status: phase.status,
        timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: "Project phase created successfully", data: phase });
});

/** Update project phase — fires completion event if status → COMPLETED */
export const updateProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const prevStatus = phase.status;
    if (name) phase.name = name;
    if (description !== undefined) phase.description = description;
    if (startDate) phase.startDate = startDate;
    if (endDate !== undefined) phase.endDate = endDate;
    if (status) phase.status = status;

    await phase.save();

    // 🔔 Phase updated — broadcast to everyone in the project room
    emitToProject(projectId, 'phase:updated', {
        type: 'UPDATED',
        phaseId: phase._id,
        phaseName: phase.name,
        projectId,
        status: phase.status,
        prevStatus,
        timestamp: new Date().toISOString(),
    });

    // ✅ Phase COMPLETED — notify all project members
    if (status === "COMPLETED" && prevStatus !== "COMPLETED") {
        const project = await Project.findById(projectId);
        const members = await ProjectMember.find({ project: projectId }).select("user");

        await Promise.all(
            members.map(m =>
                createNotification(
                    m.user,
                    `✅ مرحلة "${phase.name}" اكتملت`,
                    `تم الانتهاء من مرحلة "${phase.name}" في مشروع "${project?.name}".`,
                    'SUCCESS',
                    { projectId, phaseId: phase._id }
                ).catch(() => { })
            )
        );

        // Also emit dedicated event
        emitToProject(projectId, 'notification:phase_completed', {
            phaseId: phase._id,
            phaseName: phase.name,
            projectId,
            completedAt: new Date().toISOString(),
        });

        // 📊 Dashboard update after phase completion
        emitDashboardUpdate({ trigger: 'phase_completed', projectId, phaseId: phase._id });
    }

    // ⚠️ Phase AT RISK (DELAYED)
    if (status === "DELAYED" && prevStatus !== "DELAYED") {
        const project = await Project.findById(projectId);
        const members = await ProjectMember.find({ project: projectId }).select("user");

        await Promise.all(
            members.map(m =>
                createNotification(
                    m.user,
                    `⚠️ مرحلة "${phase.name}" متأخرة`,
                    `مرحلة "${phase.name}" في مشروع "${project?.name}" بها تأخير.`,
                    'WARNING',
                    { projectId, phaseId: phase._id }
                ).catch(() => { })
            )
        );

        emitToProject(projectId, 'notification:project_at_risk', {
            phaseId: phase._id,
            phaseName: phase.name,
            projectId,
            timestamp: new Date().toISOString(),
        });
    }

    return res.status(200).json({ success: true, message: "Project phase updated successfully", data: phase });
});

/** Delete project phase */
export const deleteProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    await phase.deleteOne();

    emitToProject(projectId, 'phase:updated', {
        type: 'DELETED',
        phaseId: id,
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Project phase deleted successfully" });
});

/**
 * Update a single permit inside a phase
 * PATCH /api/projects/:projectId/phases/:id/permits/:permitId
 */
export const updatePermit = asynchandler(async (req, res, next) => {
    const { projectId, id, permitId } = req.params;
    const { permitNumber, expiryDate, attachmentId, reviewStatus } = req.body;

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    // Find the permit by its _id
    const permit = phase.requiredPermits.id(permitId);
    if (!permit) return next(new AppError("Permit not found in this phase", 404));

    // Update only the provided fields
    if (permitNumber !== undefined) permit.permitNumber = permitNumber;
    if (expiryDate !== undefined) permit.expiryDate = expiryDate;
    if (attachmentId !== undefined) permit.attachmentId = attachmentId;

    // Auto-set reviewStatus based on permit data
    if (reviewStatus) {
        permit.reviewStatus = reviewStatus;
    } else {
        // If a permitNumber is provided, mark as APPROVED; if cleared, reset to PENDING
        permit.reviewStatus = permit.permitNumber ? "APPROVED" : "PENDING";
    }

    await phase.save();

    // Broadcast update to project room
    emitToProject(projectId, 'phase:updated', {
        type: 'PERMIT_UPDATED',
        phaseId: phase._id,
        permitId,
        projectId,
        timestamp: new Date().toISOString(),
    });

    // 🔄 Check if phase should auto-complete after permit update
    await tryAutoCompletePhase(phase, {
        emitToProject, emitDashboardUpdate, createNotification,
        ProjectMember, Project
    });

    return res.status(200).json({
        success: true,
        message: "Permit updated successfully",
        data: {
            phase: phase._id,
            permit
        }
    });
});

/**
 * Get permits summary for a phase (for Step 5 UI)
 * GET /api/projects/:projectId/phases/:id/permits
 */
export const getPhasePermits = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId })
        .populate("requiredPermits.attachmentId", "url fileUrl name");
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const permits = phase.requiredPermits.map(p => ({
        _id: p._id,
        name: p.name,
        issuingAuthority: p.issuingAuthority,
        authorityType: p.authorityType,
        permitNumber: p.permitNumber,
        expiryDate: p.expiryDate,
        reviewStatus: p.reviewStatus,
        isMandatory: p.isMandatory,
        attachment: p.attachmentId,
        isCompleted: !!p.permitNumber  // اعتبر التصريح مكتملاً إذا فيه رقم
    }));

    const mandatory = permits.filter(p => p.isMandatory);
    const completedMandatory = mandatory.filter(p => p.isCompleted);

    return res.status(200).json({
        success: true,
        data: {
            permits,
            summary: {
                total: permits.length,
                totalMandatory: mandatory.length,
                completedMandatory: completedMandatory.length,
                allMandatoryDone: mandatory.length === completedMandatory.length,
                // نفس النص اللي في الديزاين
                label: `تم إكمال ${completedMandatory.length} من أصل ${mandatory.length} تصاريح إلزامية`
            }
        }
    });
});

/**
 * Add a new permit directly to a phase (independent from blueprint)
 * POST /api/projects/:projectId/phases/:id/permits
 */
export const addPermit = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const {
        name,
        issuingAuthority = "",
        authorityType = "الجهة التنظيمية",
        permitNumber = "",
        expiryDate,
        isMandatory = true
    } = req.body;

    if (!name) return next(new AppError("اسم التصريح مطلوب", 400));

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const newPermit = {
        name,
        issuingAuthority,
        authorityType,
        permitNumber,
        expiryDate: expiryDate || null,
        isMandatory,
        reviewStatus: permitNumber ? "APPROVED" : "PENDING"
    };

    phase.requiredPermits.push(newPermit);
    await phase.save();

    const added = phase.requiredPermits[phase.requiredPermits.length - 1];

    emitToProject(projectId, 'phase:updated', {
        type: 'PERMIT_ADDED',
        phaseId: phase._id,
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
        success: true,
        message: "Permit added successfully",
        data: added
    });
});

/**
 * Delete a permit from a phase
 * DELETE /api/projects/:projectId/phases/:id/permits/:permitId
 */
export const deletePermit = asynchandler(async (req, res, next) => {
    const { projectId, id, permitId } = req.params;

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });
    if (!phase) return next(new AppError("Phase not found in this project", 404));

    const permit = phase.requiredPermits.id(permitId);
    if (!permit) return next(new AppError("Permit not found in this phase", 404));

    permit.deleteOne();
    await phase.save();

    emitToProject(projectId, 'phase:updated', {
        type: 'PERMIT_DELETED',
        phaseId: phase._id,
        permitId,
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
        success: true,
        message: "Permit deleted successfully"
    });
});
