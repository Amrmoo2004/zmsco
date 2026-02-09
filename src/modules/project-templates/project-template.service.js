import ProjectTemplate from "../../db/models/projects/project.template.js";
import Project from "../../db/models/projects/project.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all templates
 */
export const getAllTemplates = asynchandler(async (req, res, next) => {
    const templates = await ProjectTemplate.find()
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: templates
    });
});

/**
 * Get template by ID
 */
export const getTemplateById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const template = await ProjectTemplate.findById(id)
        .populate("createdBy", "name email");

    if (!template) {
        return next(new AppError("Template not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: template
    });
});

/**
 * Create template
 */
export const createTemplate = asynchandler(async (req, res, next) => {
    const { name, description, phases, defaultMembers } = req.body;

    const template = await ProjectTemplate.create({
        name,
        description,
        phases,
        defaultMembers,
        createdBy: req.user._id
    });

    await template.populate("createdBy", "name email");

    return res.status(201).json({
        success: true,
        message: "Project template created successfully",
        data: template
    });
});

/**
 * Update template
 */
export const updateTemplate = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, description, phases, defaultMembers } = req.body;

    const template = await ProjectTemplate.findById(id);

    if (!template) {
        return next(new AppError("Template not found", 404));
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (phases) template.phases = phases;
    if (defaultMembers) template.defaultMembers = defaultMembers;

    await template.save();
    await template.populate("createdBy", "name email");

    return res.status(200).json({
        success: true,
        message: "Template updated successfully",
        data: template
    });
});

/**
 * Delete template
 */
export const deleteTemplate = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const template = await ProjectTemplate.findById(id);

    if (!template) {
        return next(new AppError("Template not found", 404));
    }

    await template.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Template deleted successfully"
    });
});

/**
 * Apply template to create new project
 */
export const applyTemplate = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { projectName, startDate } = req.body;

    const template = await ProjectTemplate.findById(id);

    if (!template) {
        return next(new AppError("Template not found", 404));
    }

    // Create project from template
    const project = await Project.create({
        name: projectName,
        description: template.description,
        startDate: startDate || new Date(),
        createdBy: req.user._id,
        status: "PLANNING"
    });

    // Create phases from template
    if (template.phases && template.phases.length > 0) {
        const phases = template.phases.map(phase => ({
            project: project._id,
            name: phase.name,
            description: phase.description,
            startDate: startDate || new Date(),
            status: "PENDING"
        }));

        await ProjectPhase.insertMany(phases);
    }

    return res.status(201).json({
        success: true,
        message: "Project created from template successfully",
        data: project
    });
});
