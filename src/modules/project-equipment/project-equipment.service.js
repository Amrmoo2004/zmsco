import ProjectEquipment from "../../db/models/projects/project.equipment.js";
import Project from "../../db/models/projects/project.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get project equipment
 */
export const getProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const equipment = await ProjectEquipment.find({ project: projectId })
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: equipment
    });
});

/**
 * Add equipment to project
 */
export const addProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { name, description, quantity, status } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const equipment = await ProjectEquipment.create({
        project: projectId,
        name,
        description,
        quantity,
        status: status || "AVAILABLE"
    });

    return res.status(201).json({
        success: true,
        message: "Equipment added to project successfully",
        data: equipment
    });
});

/**
 * Update equipment
 */
export const updateProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const { name, description, quantity, status } = req.body;

    const equipment = await ProjectEquipment.findOne({ _id: id, project: projectId });

    if (!equipment) {
        return next(new AppError("Equipment not found in this project", 404));
    }

    if (name) equipment.name = name;
    if (description !== undefined) equipment.description = description;
    if (quantity !== undefined) equipment.quantity = quantity;
    if (status) equipment.status = status;

    await equipment.save();

    return res.status(200).json({
        success: true,
        message: "Equipment updated successfully",
        data: equipment
    });
});

/**
 * Remove equipment from project
 */
export const removeProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const equipment = await ProjectEquipment.findOne({ _id: id, project: projectId });

    if (!equipment) {
        return next(new AppError("Equipment not found in this project", 404));
    }

    await equipment.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Equipment removed from project successfully"
    });
});
