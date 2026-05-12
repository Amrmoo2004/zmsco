import Warehouse from "../../db/models/warehouse.model.js";
import Inventory from "../../db/models/inventory.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all warehouses — with capacity stats for the warehouse selector dropdown
 */
export const getAllWarehouses = asynchandler(async (req, res, next) => {
    const warehouses = await Warehouse.find()
        .populate("manager", "name email")
        .sort({ createdAt: -1 });

    // Add capacityPercentage and inventory count for each warehouse
    const enriched = await Promise.all(warehouses.map(async (w) => {
        const inventoryCount = await Inventory.countDocuments({ warehouse: w._id });
        const transactionsCount = await MaterialTransaction.countDocuments({
            $or: [{ fromWarehouse: w._id }, { toWarehouse: w._id }]
        });
        const capacityPercentage = w.capacity > 0
            ? Math.min(100, Math.round((w.usedCapacity / w.capacity) * 100))
            : 0;
        return {
            ...w.toObject(),
            capacityPercentage,
            inventoryItemsCount: inventoryCount,
            transactionsCount
        };
    }));

    return res.status(200).json({
        success: true,
        data: enriched
    });
});

/**
 * Get warehouse by ID — includes capacity stats for the Step 4 UI card
 */
export const getWarehouseById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id)
        .populate("manager", "name email");

    if (!warehouse) {
        return next(new AppError("Warehouse not found", 404));
    }

    // Stats for the Figma progress bar card
    const inventoryItemsCount = await Inventory.countDocuments({ warehouse: id });
    const transactionsCount = await MaterialTransaction.countDocuments({
        $or: [{ fromWarehouse: id }, { toWarehouse: id }]
    });
    const capacityPercentage = warehouse.capacity > 0
        ? Math.min(100, Math.round((warehouse.usedCapacity / warehouse.capacity) * 100))
        : 0;

    return res.status(200).json({
        success: true,
        data: {
            ...warehouse.toObject(),
            capacityPercentage,       // ← الـ % اللي بيتعرض في Progress Bar
            inventoryItemsCount,      // ← عدد العمليات المضافة
            transactionsCount         // ← عدد المعاملات
        }
    });
});

/**
 * Create new warehouse
 */
export const createWarehouse = asynchandler(async (req, res, next) => {
    const { name, location, capacity, manager } = req.body;

    // Check if warehouse with same name exists
    const existingWarehouse = await Warehouse.findOne({ name });
    if (existingWarehouse) {
        return next(new AppError("Warehouse with this name already exists", 400));
    }

    const warehouse = await Warehouse.create({
        name,
        location,
        capacity,
        manager
    });

    await warehouse.populate("manager", "name email");

    return res.status(201).json({
        success: true,
        message: "Warehouse created successfully",
        data: warehouse
    });
});

/**
 * Update warehouse
 */
export const updateWarehouse = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, location, capacity, manager } = req.body;

    const warehouse = await Warehouse.findById(id);

    if (!warehouse) {
        return next(new AppError("Warehouse not found", 404));
    }

    // Check if new name conflicts
    if (name && name !== warehouse.name) {
        const existingWarehouse = await Warehouse.findOne({ name });
        if (existingWarehouse) {
            return next(new AppError("Warehouse with this name already exists", 400));
        }
    }

    if (name) warehouse.name = name;
    if (location) warehouse.location = location;
    if (capacity !== undefined) warehouse.capacity = capacity;
    if (manager !== undefined) warehouse.manager = manager;

    await warehouse.save();
    await warehouse.populate("manager", "name email");

    return res.status(200).json({
        success: true,
        message: "Warehouse updated successfully",
        data: warehouse
    });
});

/**
 * Delete warehouse
 */
export const deleteWarehouse = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);

    if (!warehouse) {
        return next(new AppError("Warehouse not found", 404));
    }

    // Check if warehouse has inventory
    const inventoryCount = await Inventory.countDocuments({ warehouse: id });
    if (inventoryCount > 0) {
        return next(new AppError("Cannot delete warehouse with existing inventory", 400));
    }

    await warehouse.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Warehouse deleted successfully"
    });
});

/**
 * Get warehouse inventory — with status per item
 */
export const getWarehouseInventory = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) return next(new AppError("Warehouse not found", 404));

    const inventory = await Inventory.find({ warehouse: id })
        .populate("material", "name unit category alertQuantity");

    // Add status per item based on material.alertQuantity threshold
    const enriched = inventory.map(item => {
        const qty = item.quantity || 0;
        const threshold = item.material?.alertQuantity || 0;
        let status = "متوفر";
        if (qty === 0) status = "غير متوفر";
        else if (threshold > 0 && qty <= threshold) status = "منخفض";

        return {
            ...item.toObject(),
            status
        };
    });

    return res.status(200).json({
        success: true,
        data: {
            warehouse: { id: warehouse._id, name: warehouse.name, location: warehouse.location },
            inventory: enriched
        }
    });
});

/**
 * Get warehouse transactions
 */
export const getWarehouseTransactions = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) return next(new AppError("Warehouse not found", 404));

    const transactions = await MaterialTransaction.find({ warehouse: id })
        .populate("material", "name unit")
        .populate("project", "name")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: {
            warehouse: { id: warehouse._id, name: warehouse.name, location: warehouse.location },
            transactions
        }
    });
});

/**
 * GET /warehouses/:id/dashboard
 * Summary cards for the warehouse screen (رئيسي أو مشروع)
 * Returns: totalMaterials, lowStockCount, unavailableCount, activeTransfersCount, recentTransactions
 */
export const getWarehouseDashboard = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id).populate("manager", "name email");
    if (!warehouse) return next(new AppError("Warehouse not found", 404));

    // All inventory items for this warehouse
    const inventory = await Inventory.find({ warehouse: id })
        .populate("material", "name unit category alertQuantity");

    const totalMaterials = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const unavailableCount = inventory.filter(i => (i.quantity || 0) === 0).length;
    const lowStockCount = inventory.filter(i => {
        const qty = i.quantity || 0;
        const threshold = i.material?.alertQuantity || 0;
        return threshold > 0 && qty > 0 && qty <= threshold;
    }).length;

    // Active transfers = TRANSFER transactions in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeTransfersCount = await MaterialTransaction.countDocuments({
        warehouse: id,
        type: { $in: ["TRANSFER", "IN"] },
        createdAt: { $gte: sevenDaysAgo }
    });

    // Daily consumption rate = average OUT/ISSUE per day over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const consumptionAgg = await MaterialTransaction.aggregate([
        {
            $match: {
                warehouse: warehouse._id,
                type: { $in: ["OUT", "ISSUE"] },
                createdAt: { $gte: thirtyDaysAgo }
            }
        },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
    ]);
    const totalConsumed = consumptionAgg[0]?.total || 0;
    const dailyConsumptionRate = totalMaterials > 0
        ? Math.min(100, Math.round((totalConsumed / 30 / (totalMaterials || 1)) * 100))
        : 0;

    // Incoming shipments today
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const incomingToday = await MaterialTransaction.countDocuments({
        warehouse: id,
        type: { $in: ["IN", "TRANSFER"] },
        createdAt: { $gte: todayStart }
    });

    // Recent transactions (last 10)
    const recentTransactions = await MaterialTransaction.find({ warehouse: id })
        .populate("material", "name")
        .populate("project", "name code")
        .sort({ createdAt: -1 })
        .limit(10);

    // Inventory distribution by project (for pie chart)
    const projectDistribution = await MaterialTransaction.aggregate([
        { $match: { warehouse: warehouse._id, type: { $in: ["OUT", "ISSUE"] } } },
        { $group: { _id: "$project", total: { $sum: "$quantity" } } },
        { $lookup: { from: "projects", localField: "_id", foreignField: "_id", as: "project" } },
        { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },
        { $project: { projectName: "$project.name", total: 1 } },
        { $sort: { total: -1 } },
        { $limit: 5 }
    ]);

    return res.status(200).json({
        success: true,
        data: {
            warehouse,
            summary: {
                totalMaterials,
                lowStockCount,
                unavailableCount,
                activeTransfersCount,
                dailyConsumptionRate,     // % — for "معدل الاستهلاك اليومي"
                incomingToday,            // count — for "شحنات قادمة اليوم"
                inventoryItemsCount: inventory.length
            },
            projectDistribution,          // for pie chart "توزيع المخزون"
            recentTransactions
        }
    });
});
