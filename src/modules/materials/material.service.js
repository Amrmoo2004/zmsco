import Material from "../../db/models/metrials/metrials.js";
import Inventory from "../../db/models/inventory.js";
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
        .populate("category")
        .populate("unit")
        .limit(parseInt(limit))
        .skip(skip)
        .sort({ createdAt: -1 })
        .lean();

    const total = await Material.countDocuments(query);

    // Aggregate inventory balances
    const materialIds = materials.map(m => m._id);
    const inventoryBalances = await Inventory.aggregate([
        { $match: { material: { $in: materialIds } } },
        { $group: { _id: "$material", totalQuantity: { $sum: "$quantity" } } }
    ]);
    const inventoryMap = {};
    inventoryBalances.forEach(bal => { 
        inventoryMap[bal._id.toString()] = bal.totalQuantity; 
    });

    const enrichedMaterials = materials.map(material => {
        const availableQuantity = inventoryMap[material._id.toString()] || 0;
        return {
            ...material,
            availableQuantity,
            unitCost: material.standardCost || 0,
            isAvailable: availableQuantity > 0,
            source: availableQuantity > 0 ? "INVENTORY" : "PROCUREMENT"
        };
    });

    return res.status(200).json({
        success: true,
        data: enrichedMaterials,
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

    const material = await Material.findById(id)
        .populate("category")
        .populate("unit");

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
    const { name, description, unit, category, alertQuantity, standardCost } = req.body;

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
        alertQuantity,
        standardCost
    });

    await material.populate("category");
    await material.populate("unit");

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
    const { name, description, unit, category, alertQuantity, standardCost } = req.body;

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
    if (alertQuantity !== undefined) material.alertQuantity = alertQuantity;
    if (standardCost !== undefined) material.standardCost = standardCost;

    await material.save();

    await material.populate("category");
    await material.populate("unit");

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
    })
    .populate("category")
    .populate("unit")
    .limit(20)
    .lean();

    const materialIds = materials.map(m => m._id);
    const inventoryBalances = await Inventory.aggregate([
        { $match: { material: { $in: materialIds } } },
        { $group: { _id: "$material", totalQuantity: { $sum: "$quantity" } } }
    ]);
    const inventoryMap = {};
    inventoryBalances.forEach(bal => { 
        inventoryMap[bal._id.toString()] = bal.totalQuantity; 
    });

    const enrichedMaterials = materials.map(material => {
        const availableQuantity = inventoryMap[material._id.toString()] || 0;
        return {
            ...material,
            availableQuantity,
            unitCost: material.standardCost || 0,
            isAvailable: availableQuantity > 0,
            source: availableQuantity > 0 ? "INVENTORY" : "PROCUREMENT"
        };
    });

    return res.status(200).json({
        success: true,
        data: enrichedMaterials
    });
});
