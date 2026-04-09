import ReportTemplate from "../../db/models/settings/reportTemplate.model.js";
import Project from "../../db/models/projects/project.js";
import HrRequest from "../../db/models/hr/hrRequest.model.js";
import Ticket from "../../db/models/tickets/ticket.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/report-templates
export const getAllTemplates = asynchandler(async (req, res) => {
    const { type } = req.query;
    const filter = {
        $or: [{ createdBy: req.user._id }, { isPublic: true }]
    };
    if (type) filter.type = type;

    const templates = await ReportTemplate.find(filter)
        .populate("createdBy", "name email")
        .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, data: templates });
});

// GET /api/report-templates/:id
export const getTemplateById = asynchandler(async (req, res, next) => {
    const template = await ReportTemplate.findById(req.params.id)
        .populate("createdBy", "name email");
    if (!template) return next(new AppError("Report template not found", 404));

    const canAccess = template.isPublic || template.createdBy._id.toString() === req.user._id.toString();
    if (!canAccess) return next(new AppError("Unauthorized", 403));

    return res.status(200).json({ success: true, data: template });
});

// POST /api/report-templates
export const createTemplate = asynchandler(async (req, res) => {
    const template = await ReportTemplate.create({
        ...req.body,
        createdBy: req.user._id
    });
    return res.status(201).json({ success: true, message: "Report template created", data: template });
});

// PUT /api/report-templates/:id
export const updateTemplate = asynchandler(async (req, res, next) => {
    const template = await ReportTemplate.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user._id },
        req.body,
        { new: true }
    );
    if (!template) return next(new AppError("Template not found or unauthorized", 404));
    return res.status(200).json({ success: true, message: "Template updated", data: template });
});

// DELETE /api/report-templates/:id
export const deleteTemplate = asynchandler(async (req, res, next) => {
    const template = await ReportTemplate.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!template) return next(new AppError("Template not found or unauthorized", 404));
    return res.status(200).json({ success: true, message: "Template deleted" });
});

// POST /api/report-templates/:id/run
export const runTemplate = asynchandler(async (req, res, next) => {
    const template = await ReportTemplate.findById(req.params.id);
    if (!template) return next(new AppError("Template not found", 404));

    // Build filter from template config
    const dateFilter = {};
    if (template.filters?.dateFrom) dateFilter.$gte = new Date(template.filters.dateFrom);
    if (template.filters?.dateTo) dateFilter.$lte = new Date(template.filters.dateTo);

    let data = [];

    switch (template.type) {
        case "مشروع": {
            const f = {};
            if (Object.keys(dateFilter).length) f.createdAt = dateFilter;
            if (template.filters?.status?.length) f.status = { $in: template.filters.status };
            data = await Project.find(f).populate("manager", "name").select(template.columns?.join(" ") || "");
            break;
        }
        case "موارد بشرية": {
            const f = {};
            if (Object.keys(dateFilter).length) f.createdAt = dateFilter;
            if (template.filters?.status?.length) f.status = { $in: template.filters.status };
            data = await HrRequest.find(f).populate("user", "name email").select(template.columns?.join(" ") || "");
            break;
        }
        case "تذاكر": {
            const f = {};
            if (Object.keys(dateFilter).length) f.createdAt = dateFilter;
            if (template.filters?.status?.length) f.status = { $in: template.filters.status };
            data = await Ticket.find(f).populate("requester", "name").select(template.columns?.join(" ") || "");
            break;
        }
        default:
            data = [];
    }

    // Update run metadata
    await ReportTemplate.findByIdAndUpdate(req.params.id, {
        lastRunAt: new Date(),
        $inc: { runCount: 1 }
    });

    return res.status(200).json({
        success: true,
        template: { name: template.name, type: template.type },
        count: data.length,
        data
    });
});
