import ProjectPhase from "../../db/models/projects/project.phase.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitDashboardUpdate } from "../../utils/socket.js";

/** Get project phases */
export const getProjectPhases = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    const phases = await ProjectPhase.find({ project: projectId }).sort({ startDate: 1 });
    return res.status(200).json({ success: true, data: phases });
});

/** Create project phase */
export const createProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    const phase = await ProjectPhase.create({
        project: projectId,
        name, description, startDate, endDate,
        status: status || "PENDING"
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
