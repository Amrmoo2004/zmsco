import ProjectDocument from "../../db/models/projects/project.document.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { uploadFile } from "../attachments/attachment.service.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject } from "../../utils/socket.js";

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
        .sort({ createdAt: -1 });

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
 * Upload project document (accepts multipart/form-data with a 'file' field)
 * Saves the Cloudinary URL to ProjectDocument.fileUrl
 * Notifies all project members via Socket.IO
 */
export const uploadProjectDocument = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { name, isRequired } = req.body;

    const project = await Project.findById(projectId).populate("members.user", "_id");
    if (!project) {
        return next(new AppError("Project not found", 404));
    }

    if (!req.file) {
        return next(new AppError('No file uploaded. Send a multipart/form-data request with field "file"', 400));
    }

    // 1. Upload file to Cloudinary → creates Attachment record
    const attachment = await uploadFile(
        req.file,
        req.user._id,
        { refModel: 'ProjectDocument' },
        'project-documents'
    );

    // 2. Create the ProjectDocument with the Cloudinary URL
    const document = await ProjectDocument.create({
        project: projectId,
        name: name || req.file.originalname,
        fileUrl: attachment.url,
        isRequired: isRequired !== undefined ? isRequired : true,
        status: 'UPLOADED',
    });

    // 3. Get all project members
    const members = await ProjectMember.find({ project: projectId }).select("user");
    const memberIds = members.map(m => String(m.user));
    if (project.manager) memberIds.push(String(project.manager));
    const uniqueIds = [...new Set(memberIds)].filter(id => id !== String(req.user._id));

    // 4. Notify members (DB + Socket.IO via createNotification)
    await Promise.all(
        uniqueIds.map(userId =>
            createNotification(
                userId,
                '📎 مرفق جديد رُفِع',
                `تم رفع مستند "${document.name}" في مشروع "${project.name}".`,
                'INFO',
                { projectId, documentId: document._id }
            ).catch(() => { })
        )
    );

    // 5. Broadcast attachment:added to everyone viewing the project
    emitToProject(projectId, 'attachment:added', {
        documentId: document._id,
        documentName: document.name,
        fileUrl: attachment.url,
        uploadedBy: req.user._id,
        projectId,
        timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: { document, attachment }
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
