import ProjectPhaseTemplate from "../../db/models/settings/projectPhaseTemplate.model.js";
import { asynchandler } from "../../utils/response/response.js";
import { AppError } from "../../utils/appError.js";

export const getAllPhases = asynchandler(async (req, res, next) => {
    const phases = await ProjectPhaseTemplate.find({ isActive: true }).sort({ order: 1 });
    return res.status(200).json({ success: true, data: phases });
});

export const createPhase = asynchandler(async (req, res, next) => {
    const phase = await ProjectPhaseTemplate.create(req.body);
    return res.status(201).json({ success: true, message: "Phase created", data: phase });
});

export const updatePhase = asynchandler(async (req, res, next) => {
    const phase = await ProjectPhaseTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!phase) return next(new AppError("Phase not found", 404));
    return res.status(200).json({ success: true, message: "Phase updated", data: phase });
});

export const deletePhase = asynchandler(async (req, res, next) => {
    const phase = await ProjectPhaseTemplate.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!phase) return next(new AppError("Phase not found", 404));
    return res.status(200).json({ success: true, message: "Phase deleted" });
});
