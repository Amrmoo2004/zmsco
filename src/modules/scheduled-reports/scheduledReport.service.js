import ScheduledReport from "../../db/models/settings/scheduledReport.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/scheduled-reports
export const getAllScheduledReports = asynchandler(async (req, res) => {
    const reports = await ScheduledReport.find()
        .populate("createdBy", "name email")
        .populate("recipients", "name email")
        .populate("reportTemplate", "name type category")
        .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, data: reports });
});

// GET /api/scheduled-reports/:id
export const getScheduledReportById = asynchandler(async (req, res, next) => {
    const report = await ScheduledReport.findById(req.params.id)
        .populate("createdBy", "name email")
        .populate("recipients", "name email")
        .populate("reportTemplate", "name type category");
        
    if (!report) return next(new AppError("Scheduled report not found", 404));

    return res.status(200).json({ success: true, data: report });
});

// POST /api/scheduled-reports
export const createScheduledReport = asynchandler(async (req, res) => {
    const report = await ScheduledReport.create({
        ...req.body,
        createdBy: req.user._id
    });
    return res.status(201).json({ success: true, message: "Scheduled report created", data: report });
});

// PUT /api/scheduled-reports/:id
export const updateScheduledReport = asynchandler(async (req, res, next) => {
    const report = await ScheduledReport.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!report) return next(new AppError("Scheduled report not found", 404));

    return res.status(200).json({ success: true, message: "Scheduled report updated", data: report });
});

// DELETE /api/scheduled-reports/:id
export const deleteScheduledReport = asynchandler(async (req, res, next) => {
    const report = await ScheduledReport.findByIdAndDelete(req.params.id);
    if (!report) return next(new AppError("Scheduled report not found", 404));

    return res.status(200).json({ success: true, message: "Scheduled report deleted" });
});

// PATCH /api/scheduled-reports/:id/toggle
export const toggleScheduledReportStatus = asynchandler(async (req, res, next) => {
    const report = await ScheduledReport.findById(req.params.id);
    if (!report) return next(new AppError("Scheduled report not found", 404));

    report.isActive = !report.isActive;
    await report.save();

    return res.status(200).json({ success: true, message: `Report status changed to ${report.isActive ? 'Active' : 'Stopped'}`, data: report });
});
