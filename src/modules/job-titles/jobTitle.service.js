import JobTitle from "../../db/models/settings/jobTitle.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getAllJobTitles = asynchandler(async (req, res) => {
    const jobTitles = await JobTitle.find().populate("department", "name").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: jobTitles });
});

export const getJobTitleById = asynchandler(async (req, res, next) => {
    const jt = await JobTitle.findById(req.params.id).populate("department", "name");
    if (!jt) return next(new AppError("Job Title not found", 404));
    return res.status(200).json({ success: true, data: jt });
});

export const createJobTitle = asynchandler(async (req, res, next) => {
    const { title, department, description } = req.body;
    const existing = await JobTitle.findOne({ title });
    if (existing) return next(new AppError("Job Title with this name already exists", 400));
    const jt = await JobTitle.create({ title, department, description });
    return res.status(201).json({ success: true, message: "Job Title created successfully", data: jt });
});

export const updateJobTitle = asynchandler(async (req, res, next) => {
    const jt = await JobTitle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!jt) return next(new AppError("Job Title not found", 404));
    return res.status(200).json({ success: true, message: "Job Title updated successfully", data: jt });
});

export const deleteJobTitle = asynchandler(async (req, res, next) => {
    const jt = await JobTitle.findByIdAndDelete(req.params.id);
    if (!jt) return next(new AppError("Job Title not found", 404));
    return res.status(200).json({ success: true, message: "Job Title deleted successfully" });
});
