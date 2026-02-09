import ProjectPhase from "../../db/models/projects/project.phase.js";
import Project from "../../db/models/projects/project.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get project phases
 */
export const getProjectPhases = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const phases = await ProjectPhase.find({ project: projectId })
        .sort({ startDate: 1 });

    return res.status(200).json({
        success: true,
        data: phases
    });
});

/**
 * Create project phase
 */
export const createProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const phase = await ProjectPhase.create({
        project: projectId,
        name,
        description,
        startDate,
        endDate,
        status: status || "PENDING"
    });

    return res.status(201).json({
        success: true,
        message: "Project phase created successfully",
        data: phase
    });
});

/**
 * Update project phase
 */
export const updateProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });

    if (!phase) {
        return next(new AppError("Phase not found in this project", 404));
    }

    if (name) phase.name = name;
    if (description !== undefined) phase.description = description;
    if (startDate) phase.startDate = startDate;
    if (endDate !== undefined) phase.endDate = endDate;
    if (status) phase.status = status;

    await phase.save();

    return res.status(200).json({
        success: true,
        message: "Project phase updated successfully",
        data: phase
    });
});

/**
 * Delete project phase
 */
export const deleteProjectPhase = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const phase = await ProjectPhase.findOne({ _id: id, project: projectId });

    if (!phase) {
        return next(new AppError("Phase not found in this project", 404));
    }

    await phase.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Project phase deleted successfully"
    });
});
