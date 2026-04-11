import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import Material from "../../db/models/metrials/metrials.js";
import Project from "../../db/models/projects/project.js";
import Warehouse from "../../db/models/warehouse.model.js";
import Inventory from "../../db/models/inventory.js";
import SystemConfiguration from "../../db/models/settings/systemConfiguration.model.js";
import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import eventBus from "../../events/index.js";

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
 * Create material transaction (IN or OUT) - Supports grouping in Array
 */
export const createTransaction = asynchandler(async (req, res, next) => {
    const transactionsData = Array.isArray(req.body) ? req.body : (req.body.transactions ? req.body.transactions : [req.body]);

    if (!transactionsData || transactionsData.length === 0) {
        return next(new AppError("No transactions provided", 400));
    }

    const config = await SystemConfiguration.findOne();
    const approvalRequired = config?.inventorySettings?.approvalOnIssuance || false;

    // First Array Pass: Validate Everything (Fail Fast)
    for (const trx of transactionsData) {
        const { material, quantity, type, warehouse, project, referenceRequest } = trx;

        if (type === "OUT" && approvalRequired) {
            if (!referenceRequest) {
                return next(new AppError("System configuration requires an approved Material Request for stock issuance.", 403));
            }
            const matReq = await MaterialRequest.findById(referenceRequest);
            if (!matReq) return next(new AppError("Reference Material Request not found.", 404));
            if (matReq.status !== "APPROVED") return next(new AppError("Material Request must be APPROVED before issuance.", 403));
        }

        const materialExists = await Material.findById(material);
        if (!materialExists) return next(new AppError(`Material ${material} not found`, 404));

        const warehouseExists = await Warehouse.findById(warehouse);
        if (!warehouseExists) return next(new AppError(`Warehouse ${warehouse} not found`, 404));

        if (project) {
            const projectExists = await Project.findById(project);
            if (!projectExists) return next(new AppError(`Project ${project} not found`, 404));
        }

        if (type === "OUT") {
            const inventory = await Inventory.findOne({ material, warehouse });
            if (!inventory || inventory.quantity < quantity) {
                return next(new AppError(`Insufficient inventory for material ${material} in warehouse ${warehouse}`, 400));
            }
        }
    }

    // Second Array Pass: Execute Transactions & Update Inventory
    let createdTransactions = [];
    for (const trx of transactionsData) {
        const { material, quantity, type, warehouse, project, notes, referenceRequest } = trx;

        // 1. Create transaction doc
        const transaction = await MaterialTransaction.create({
            material,
            quantity,
            type,
            warehouse,
            project,
            notes,
            referenceRequest,
            createdBy: req.user._id
        });

        // 2. Adjust inventory
        const multiplier = type === "IN" ? 1 : -1;
        const updatedInventory = await Inventory.findOneAndUpdate(
            { material, warehouse },
            {
                $inc: { quantity: quantity * multiplier },
                $set: { lastUpdated: new Date() }
            },
            { new: true, upsert: true }
        );

        if (type === "OUT" && updatedInventory) {
            // Fire background task to check low stock
            eventBus.emit('INVENTORY_UPDATED', {
                materialId: material,
                currentQuantity: updatedInventory.quantity,
                warehouseId: warehouse
            });
        }

        await transaction.populate("material", "name unit");
        await transaction.populate("warehouse", "name location");
        if (project) await transaction.populate("project", "name");

        createdTransactions.push(transaction);
    }

    return res.status(201).json({
        success: true,
        message: "Material transaction(s) created successfully",
        data: createdTransactions
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
