import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import Material from "../../db/models/metrials/metrials.js";
import Project from "../../db/models/projects/project.js";
import Warehouse from "../../db/models/warehouse.model.js";
import Inventory from "../../db/models/inventory.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all transactions with filters
 */
export const getAllTransactions = asynchandler(async (req, res, next) => {
    const { material, project, warehouse, type } = req.query;

    const query = {};

    if (material) query.material = material;
    if (project) query.project = project;
    if (warehouse) query.warehouse = warehouse;
    if (type) query.type = type;

    const transactions = await MaterialTransaction.find(query)
        .populate("material", "name unit")
        .populate("project", "name")
        .populate("warehouse", "name location")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: transactions
    });
});

/**
 * Get transaction by ID
 */
export const getTransactionById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const transaction = await MaterialTransaction.findById(id)
        .populate("material", "name unit")
        .populate("project", "name")
        .populate("warehouse", "name location")
        .populate("createdBy", "name email");

    if (!transaction) {
        return next(new AppError("Transaction not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: transaction
    });
});

/**
 * Create material transaction (IN or OUT)
 */
export const createTransaction = asynchandler(async (req, res, next) => {
    const { material, quantity, type, warehouse, project, notes } = req.body;

    // Validate material exists
    const materialExists = await Material.findById(material);
    if (!materialExists) {
        return next(new AppError("Material not found", 404));
    }

    // Validate warehouse exists
    const warehouseExists = await Warehouse.findById(warehouse);
    if (!warehouseExists) {
        return next(new AppError("Warehouse not found", 404));
    }

    // Validate project if provided
    if (project) {
        const projectExists = await Project.findById(project);
        if (!projectExists) {
            return next(new AppError("Project not found", 404));
        }
    }

    // Check inventory for OUT transactions
    if (type === "OUT") {
        const inventory = await Inventory.findOne({ material, warehouse });
        if (!inventory || inventory.quantity < quantity) {
            return next(new AppError("Insufficient inventory for this transaction", 400));
        }
    }

    // Create transaction
    const transaction = await MaterialTransaction.create({
        material,
        quantity,
        type,
        warehouse,
        project,
        notes,
        createdBy: req.user._id
    });

    // Update inventory
    const multiplier = type === "IN" ? 1 : -1;
    await Inventory.updateOne(
        { material, warehouse },
        {
            $inc: { quantity: quantity * multiplier },
            $set: { lastUpdated: new Date() }
        },
        { upsert: true }
    );

    await transaction.populate("material", "name unit");
    await transaction.populate("warehouse", "name location");
    if (project) await transaction.populate("project", "name");

    return res.status(201).json({
        success: true,
        message: "Material transaction created successfully",
        data: transaction
    });
});

/**
 * Get transactions by material
 */
export const getTransactionsByMaterial = asynchandler(async (req, res, next) => {
    const { materialId } = req.params;

    const transactions = await MaterialTransaction.find({ material: materialId })
        .populate("warehouse", "name location")
        .populate("project", "name")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: transactions
    });
});

/**
 * Get transactions by project
 */
export const getTransactionsByProject = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;

    const transactions = await MaterialTransaction.find({ project: projectId })
        .populate("material", "name unit")
        .populate("warehouse", "name location")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: transactions
    });
});
