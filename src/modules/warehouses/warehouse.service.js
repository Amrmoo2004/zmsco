import Warehouse from "../../db/models/warehouse.model.js";
import Inventory from "../../db/models/inventory.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all warehouses
 */
export const getAllWarehouses = asynchandler(async (req, res, next) => {
    const warehouses = await Warehouse.find()
        .populate("manager", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: warehouses
    });
});

/**
 * Get warehouse by ID
 */
export const getWarehouseById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id)
        .populate("manager", "name email");

    if (!warehouse) {
        return next(new AppError("Warehouse not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: warehouse
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
 * Get warehouse inventory
 */
export const getWarehouseInventory = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
        return next(new AppError("Warehouse not found", 404));
    }

    const inventory = await Inventory.find({ warehouse: id })
        .populate("material", "name unit category");

    return res.status(200).json({
        success: true,
        data: {
            warehouse: {
                id: warehouse._id,
                name: warehouse.name,
                location: warehouse.location
            },
            inventory
        }
    });
});

/**
 * Get warehouse transactions
 */
export const getWarehouseTransactions = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
        return next(new AppError("Warehouse not found", 404));
    }

    const transactions = await MaterialTransaction.find({ warehouse: id })
        .populate("material", "name unit")
        .populate("project", "name")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: {
            warehouse: {
                id: warehouse._id,
                name: warehouse.name,
                location: warehouse.location
            },
            transactions
        }
    });
});
