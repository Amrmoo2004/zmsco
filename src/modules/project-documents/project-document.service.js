import ProjectDocument from "../../db/models/projects/project.document.js";
import Project from "../../db/models/projects/project.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get project documents
 */
export const getProjectDocuments = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const documents = await ProjectDocument.find({ project: projectId })
        .populate("uploadedBy", "name email")
        .sort({ uploadedAt: -1 });

    return res.status(200).json({
        success: true,
        data: documents
    });
});

/**
 * Get document by ID
 */
export const getDocumentById = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const document = await ProjectDocument.findOne({ _id: id, project: projectId })
        .populate("uploadedBy", "name email");

    if (!document) {
        return next(new AppError("Document not found in this project", 404));
    }

    return res.status(200).json({
        success: true,
        data: document
    });
});

/**
 * Upload project document
 */
export const uploadProjectDocument = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { name, url, type, description } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    const document = await ProjectDocument.create({
        project: projectId,
        name,
        url,
        type,
        description,
        uploadedBy: req.user._id
    });

    await document.populate("uploadedBy", "name email");

    return res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: document
    });
});

/**
 * Delete project document
 */
export const deleteProjectDocument = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const document = await ProjectDocument.findOne({ _id: id, project: projectId });

    if (!document) {
        return next(new AppError("Document not found in this project", 404));
    }

    await document.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Document deleted successfully"
    });
});
