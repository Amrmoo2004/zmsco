import mongoose from "mongoose";
import ProjectType from "../../db/models/settings/projectType.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getAllProjectTypes = asynchandler(async (req, res) => {
    const types = await ProjectType.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: types });
});

export const getProjectTypeById = asynchandler(async (req, res, next) => {
    const pt = await ProjectType.findById(req.params.id);
    if (!pt) return next(new AppError("Project Type not found", 404));
    return res.status(200).json({ success: true, data: pt });
});

export const createProjectType = asynchandler(async (req, res, next) => {
    let { nameAr, nameEn, code, description, category, phases, defaultResources } = req.body;
    
    if(!nameAr && !nameEn) {
        return next(new AppError("Project Type name is required in Arabic or English", 400));
    }

    const existing = await ProjectType.findOne({ $or: [{ nameAr: nameAr || "N/A" }, { nameEn: nameEn || "N/A" }, { code }] });
    if (existing) return next(new AppError("Project Type with this name or code already exists", 400));

    // The Frontend handles fetching the default global phases and populating the UI.
    // If the frontend sends an empty array, it means the user explicitly deleted all phases.
    if (!phases) {
        phases = []; // Ensure it's passed as an empty array if undefined
    }

    const pt = await ProjectType.create({ nameAr, nameEn, code, description, category, phases, defaultResources });
    return res.status(201).json({ success: true, message: "Project Type created successfully", data: pt });
});

export const updateProjectType = asynchandler(async (req, res, next) => {
    const pt = await ProjectType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pt) return next(new AppError("Project Type not found", 404));
    return res.status(200).json({ success: true, message: "Project Type updated successfully", data: pt });
});

export const deleteProjectType = asynchandler(async (req, res, next) => {
    const pt = await ProjectType.findByIdAndDelete(req.params.id);
    if (!pt) return next(new AppError("Project Type not found", 404));
    return res.status(200).json({ success: true, message: "Project Type deleted successfully" });
});

export const instantiatePhases = asynchandler(async (req, res, next) => {
    const pt = await ProjectType.findById(req.params.id);
    if (!pt) return next(new AppError("Project Type not found", 404));

    const instantiatedPhases = pt.phases.map(phase => {
        // Prepare customFields based on the blueprint fields
        const customFields = {};
        if (phase.fields && phase.fields.length > 0) {
            phase.fields.forEach(f => {
                customFields[f.name] = ""; // Empty value for frontend to fill
            });
        }

        // Map attachments
        const requiredAttachments = [];
        if (phase.attachments && phase.attachments.length > 0) {
            phase.attachments.forEach(att => {
                requiredAttachments.push({
                    documentType: att.name,
                    isMandatory: att.isRequired
                });
            });
        }


        // Map approvals
        const requiredApprovals = [];
        if (phase.approvals && phase.approvals.length > 0) {
            phase.approvals.forEach(app => {
                requiredApprovals.push({
                    role: app.entity,
                    isMandatory: app.isRequired
                });
            });
        }

        // Map permits
        const requiredPermits = [];
        if (phase.permits && phase.permits.length > 0) {
            phase.permits.forEach(p => {
                requiredPermits.push({
                    name: p.name,
                    isMandatory: p.isRequired
                });
            });
        }

        // Map tasks
        const tasks = phase.tasks ? phase.tasks.map(t => ({
            name: t.name,
            description: t.description,
            isRequired: t.isRequired,
            status: "PENDING"
        })) : [];

        return {
            nameAr: phase.nameAr,
            nameEn: phase.nameEn,
            color: phase.color,
            order: phase.order,
            expectedDays: phase.expectedDays,
            isRequired: phase.isRequired,
            customFields,
            requiredAttachments,
            requiredApprovals,
            requiredPermits,
            tasks
        };
    });

    return res.status(200).json({ success: true, data: instantiatedPhases });
});
