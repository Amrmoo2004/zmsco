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
    let { name, nameAr, nameEn, code, description, category, phases, defaultResources } = req.body;
    
    // Fallback name if only nameAr/nameEn is provided
    name = name || nameAr || nameEn;

    const existing = await ProjectType.findOne({ $or: [{ name }, { code }] });
    if (existing) return next(new AppError("Project Type with this name or code already exists", 400));

    // Inject default phases from Global Settings if none provided
    if (!phases || phases.length === 0) {
        const globalPhases = await mongoose.model("ProjectPhaseTemplate").find({ isActive: true }).sort({ order: 1 });
        if (globalPhases && globalPhases.length > 0) {
            phases = globalPhases.map(p => ({
                name: p.nameEn || p.nameAr,
                nameAr: p.nameAr,
                nameEn: p.nameEn,
                order: p.order,
                expectedDays: 30, // Default duration fallback
                color: p.color || "#3498db"
            }));
        } else {
             phases = [
                 { nameAr: "التخطيط", nameEn: "Planning", name: "Planning", order: 1, expectedDays: 15, color: "#3498db" },
                 { nameAr: "التصميم", nameEn: "Design", name: "Design", order: 2, expectedDays: 30, color: "#9b59b6" },
                 { nameAr: "التنفيذ", nameEn: "Execution", name: "Execution", order: 3, expectedDays: 120, color: "#f1c40f" },
                 { nameAr: "الإغلاق", nameEn: "Closure", name: "Closure", order: 4, expectedDays: 10, color: "#2ecc71" }
             ];
        }
    }

    const pt = await ProjectType.create({ name, nameAr, nameEn, code, description, category, phases, defaultResources });
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

        return {
            name: phase.name,
            order: phase.order,
            expectedDays: phase.expectedDays,
            isRequired: phase.isRequired,
            customFields,
            requiredAttachments,
            requiredApprovals
        };
    });

    return res.status(200).json({ success: true, data: instantiatedPhases });
});
