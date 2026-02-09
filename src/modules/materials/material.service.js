import Material from "../../db/models/metrials/metrials.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all materials with pagination and filtering
 */
export const getAllMaterials = asynchandler(async (req, res, next) => {
    const { page = 1, limit = 10, search, category } = req.query;

    const query = {};

    // Search filter
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
        ];
    }

    // Category filter
    if (category) {
        query.category = category;
    }

    const skip = (page - 1) * limit;

    const materials = await Material.find(query)
        .limit(parseInt(limit))
        .skip(skip)
        .sort({ createdAt: -1 });

    const total = await Material.countDocuments(query);

    return res.status(200).json({
        success: true,
        data: materials,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
        }
    });
});

/**
 * Get material by ID
 */
export const getMaterialById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const material = await Material.findById(id);

    if (!material) {
        return next(new AppError("Material not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: material
    });
});

/**
 * Create new material
 */
export const createMaterial = asynchandler(async (req, res, next) => {
    const { name, description, unit, category, minStockLevel } = req.body;

    // Check if material with same name exists
    const existingMaterial = await Material.findOne({ name });
    if (existingMaterial) {
        return next(new AppError("Material with this name already exists", 400));
    }

    const material = await Material.create({
        name,
        description,
        unit,
        category,
        minStockLevel
    });

    return res.status(201).json({
        success: true,
        message: "Material created successfully",
        data: material
    });
});

/**
 * Update material
 */
export const updateMaterial = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, description, unit, category, minStockLevel } = req.body;

    const material = await Material.findById(id);

    if (!material) {
        return next(new AppError("Material not found", 404));
    }

    // Check if new name conflicts with existing material
    if (name && name !== material.name) {
        const existingMaterial = await Material.findOne({ name });
        if (existingMaterial) {
            return next(new AppError("Material with this name already exists", 400));
        }
    }

    // Update fields
    if (name) material.name = name;
    if (description !== undefined) material.description = description;
    if (unit) material.unit = unit;
    if (category) material.category = category;
    if (minStockLevel !== undefined) material.minStockLevel = minStockLevel;

    await material.save();

    return res.status(200).json({
        success: true,
        message: "Material updated successfully",
        data: material
    });
});

/**
 * Delete material
 */
export const deleteMaterial = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const material = await Material.findById(id);

    if (!material) {
        return next(new AppError("Material not found", 404));
    }

    await material.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Material deleted successfully"
    });
});

/**
 * Search materials by name or code
 */
export const searchMaterials = asynchandler(async (req, res, next) => {
    const { q } = req.query;

    if (!q) {
        return next(new AppError("Search query is required", 400));
    }

    const materials = await Material.find({
        $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } }
        ]
    }).limit(20);

    return res.status(200).json({
        success: true,
        data: materials
    });
});
