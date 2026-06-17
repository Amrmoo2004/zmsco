import ProjectDocument from "../../db/models/projects/project.document.js";
import Project from "../../db/models/projects/project.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
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
    if (!project) return next(new AppError("Project not found", 404));

    const { phase } = req.query;
    const query = { project: projectId };
    if (phase) query.phase = phase;

    const documents = await ProjectDocument.find(query)
        .populate("uploadedBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: documents });
});

/**
 * Get document by ID
 */
export const getDocumentById = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const document = await ProjectDocument.findOne({ _id: id, project: projectId })
        .populate("uploadedBy", "name email");

    if (!document) return next(new AppError("Document not found in this project", 404));

    return res.status(200).json({ success: true, data: document });
});

/**
 * Upload project document (multipart/form-data, field: 'file')
 * Saves to Cloudinary and creates ProjectDocument record.
 *
 * Body fields:
 *   name         - display name
 *   phase        - ObjectId of the ProjectPhase (optional)
 *   slotId       - ObjectId of the requiredAttachments subdoc to fill (optional)
 *   documentType - name to match against requiredAttachments[].documentType (optional fallback)
 *
 * When `phase` is provided, the service also updates the matching
 * phase.requiredAttachments[] slot so that get_phase_details correctly
 * counts uploaded attachments.
 */
export const uploadProjectDocument = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const { name, isRequired, phase, slotId, documentType } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

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
        phase: phase || undefined,
        name: name || req.file.originalname,
        fileUrl: attachment.url,
        isRequired: isRequired !== undefined ? isRequired : true,
        status: 'UPLOADED',
        uploadedBy: req.user._id,
    });

    // 3. Sync into phase.requiredAttachments[] so statistics stay accurate
    if (phase) {
        const phaseDoc = await ProjectPhase.findOne({ _id: phase, project: projectId });
        if (phaseDoc && phaseDoc.requiredAttachments && phaseDoc.requiredAttachments.length > 0) {
            let slot;
            if (slotId) {
                // Exact slot id provided by frontend
                slot = phaseDoc.requiredAttachments.id(slotId);
            } else if (documentType) {
                // Match by documentType name, pick first unattached
                slot = phaseDoc.requiredAttachments.find(
                    s => !s.attachmentId && s.documentType === documentType
                );
            } else {
                // Auto: fill the first unattached slot
                slot = phaseDoc.requiredAttachments.find(s => !s.attachmentId);
            }

            if (slot) {
                slot.attachmentId = document._id;
                slot.reviewStatus = "PENDING"; // awaiting manager review
                await phaseDoc.save();
            }
        }
    }

    // 4. Get all project members for notifications
    const members = await ProjectMember.find({ project: projectId }).select("user");
    const memberIds = members.map(m => String(m.user));
    if (project.manager) memberIds.push(String(project.manager));
    const uniqueIds = [...new Set(memberIds)].filter(id => id !== String(req.user._id));

    // 5. Notify members
    await Promise.all(
        uniqueIds.map(userId =>
            createNotification(
                userId,
                '📎 مرفق جديد رُفِع',
                `تم رفع مستند "${document.name}" في مشروع "${project.name}".`,
                'INFO',
                { projectId, documentId: document._id, phaseId: document.phase || phase || undefined }
            ).catch(() => { })
        )
    );

    // 6. Broadcast to project room via Socket.IO
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
    if (!document) return next(new AppError("Document not found in this project", 404));

    await document.deleteOne();

    return res.status(200).json({ success: true, message: "Document deleted successfully" });
});
