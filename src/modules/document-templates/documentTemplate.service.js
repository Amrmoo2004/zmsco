import DocumentTemplate from "../../db/models/settings/documentTemplate.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/document-templates
export const getAllTemplates = asynchandler(async (req, res) => {
    const templates = await DocumentTemplate.find()
        .populate("createdBy", "name email")
        .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, data: templates });
});

// GET /api/document-templates/:id
export const getTemplateById = asynchandler(async (req, res, next) => {
    const template = await DocumentTemplate.findById(req.params.id)
        .populate("createdBy", "name email");
    if (!template) return next(new AppError("Document template not found", 404));

    return res.status(200).json({ success: true, data: template });
});

// POST /api/document-templates
export const createTemplate = asynchandler(async (req, res) => {
    const template = await DocumentTemplate.create({
        ...req.body,
        createdBy: req.user._id
    });
    return res.status(201).json({ success: true, message: "Document template created", data: template });
});

// PUT /api/document-templates/:id
export const updateTemplate = asynchandler(async (req, res, next) => {
    const template = await DocumentTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) return next(new AppError("Document template not found", 404));

    return res.status(200).json({ success: true, message: "Document template updated", data: template });
});

// DELETE /api/document-templates/:id
export const deleteTemplate = asynchandler(async (req, res, next) => {
    const template = await DocumentTemplate.findByIdAndDelete(req.params.id);
    if (!template) return next(new AppError("Document template not found", 404));

    return res.status(200).json({ success: true, message: "Document template deleted" });
});
