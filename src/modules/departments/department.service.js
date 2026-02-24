import Department from "../../db/models/settings/department.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getAllDepartments = asynchandler(async (req, res) => {
    const departments = await Department.find().populate("manager", "name email").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: departments });
});

export const getDepartmentById = asynchandler(async (req, res, next) => {
    const dept = await Department.findById(req.params.id).populate("manager", "name email");
    if (!dept) return next(new AppError("Department not found", 404));
    return res.status(200).json({ success: true, data: dept });
});

export const createDepartment = asynchandler(async (req, res, next) => {
    const { name, description, manager } = req.body;
    const existing = await Department.findOne({ name });
    if (existing) return next(new AppError("Department with this name already exists", 400));
    const dept = await Department.create({ name, description, manager });
    return res.status(201).json({ success: true, message: "Department created successfully", data: dept });
});

export const updateDepartment = asynchandler(async (req, res, next) => {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dept) return next(new AppError("Department not found", 404));
    return res.status(200).json({ success: true, message: "Department updated successfully", data: dept });
});

export const deleteDepartment = asynchandler(async (req, res, next) => {
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) return next(new AppError("Department not found", 404));
    return res.status(200).json({ success: true, message: "Department deleted successfully" });
});
