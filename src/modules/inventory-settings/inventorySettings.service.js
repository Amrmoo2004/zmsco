import MaterialCategory from "../../db/models/settings/materialCategory.model.js";
import MeasurementUnit from "../../db/models/settings/measurementUnit.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// --- Material Categories ---

export const getCategories = asynchandler(async (req, res) => {
    const categories = await MaterialCategory.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: categories });
});

export const createCategory = asynchandler(async (req, res, next) => {
    const { nameAr, nameEn, code } = req.body;
    
    const existing = await MaterialCategory.findOne({ code });
    if (existing) return next(new AppError("Category code already exists", 400));
    
    const category = await MaterialCategory.create({ nameAr, nameEn, code });
    res.status(201).json({ success: true, message: "Category created", data: category });
});

export const updateCategory = asynchandler(async (req, res, next) => {
    const category = await MaterialCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return next(new AppError("Category not found", 404));
    res.status(200).json({ success: true, message: "Category updated", data: category });
});

export const deleteCategory = asynchandler(async (req, res, next) => {
    const category = await MaterialCategory.findByIdAndDelete(req.params.id);
    if (!category) return next(new AppError("Category not found", 404));
    res.status(200).json({ success: true, message: "Category deleted" });
});

// --- Measurement Units ---

export const getUnits = asynchandler(async (req, res) => {
    const units = await MeasurementUnit.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: units });
});

export const createUnit = asynchandler(async (req, res, next) => {
    const { nameAr, nameEn, code, type } = req.body;
    
    const existing = await MeasurementUnit.findOne({ code });
    if (existing) return next(new AppError("Unit code already exists", 400));
    
    const unit = await MeasurementUnit.create({ nameAr, nameEn, code, type });
    res.status(201).json({ success: true, message: "Unit created", data: unit });
});

export const updateUnit = asynchandler(async (req, res, next) => {
    const unit = await MeasurementUnit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!unit) return next(new AppError("Unit not found", 404));
    res.status(200).json({ success: true, message: "Unit updated", data: unit });
});

export const deleteUnit = asynchandler(async (req, res, next) => {
    const unit = await MeasurementUnit.findByIdAndDelete(req.params.id);
    if (!unit) return next(new AppError("Unit not found", 404));
    res.status(200).json({ success: true, message: "Unit deleted" });
});
