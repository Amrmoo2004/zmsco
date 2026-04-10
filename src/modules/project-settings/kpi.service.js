import ProjectKpi from "../../db/models/settings/projectKpi.model.js";
import { asynchandler } from "../../utils/response/response.js";
import { AppError } from "../../utils/appError.js";

export const getAllKpis = asynchandler(async (req, res, next) => {
    const kpis = await ProjectKpi.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: kpis });
});

export const createKpi = asynchandler(async (req, res, next) => {
    const kpi = await ProjectKpi.create(req.body);
    return res.status(201).json({ success: true, message: "KPI created", data: kpi });
});

export const updateKpi = asynchandler(async (req, res, next) => {
    const kpi = await ProjectKpi.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!kpi) return next(new AppError("KPI not found", 404));
    return res.status(200).json({ success: true, message: "KPI updated", data: kpi });
});

export const deleteKpi = asynchandler(async (req, res, next) => {
    const kpi = await ProjectKpi.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!kpi) return next(new AppError("KPI not found", 404));
    return res.status(200).json({ success: true, message: "KPI deleted" });
});
