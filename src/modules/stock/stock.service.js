import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import Inventory from "../../db/models/inventory.js";
import ProjectMaterial from "../../db/models/metrials/📁 projectMaterial.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * CREATE MATERIAL REQUEST
 */
export const createRequest = asynchandler(async (req, res, next) => {
    const { projectId, items } = req.body; // items: [{ materialId, quantity }]
    const userId = req.user._id;
    if (!req.user?._id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }


    // 1. Create Request
    const materialRequest = await MaterialRequest.create({
        project: projectId,
        requestedBy: userId,
        items: items.map(item => ({
            material: item.materialId,
            quantity: item.quantity
        })),
        status: "PENDING"
    });

    return res.status(201).json({
        success: true,
        message: "Material request created successfully",
        data: materialRequest
    });
});

/**
 * APPROVE MATERIAL REQUEST
 */
export const approveRequest = asynchandler(async (req, res, next) => {
    const { requestId } = req.params;
    const userId = req.user._id;

    const request = await MaterialRequest.findById(requestId).populate("project");
    if (!request) {
        return next(new AppError("Request not found", 404));
    }

    if (request.status !== "PENDING") {
        return next(new AppError("Request is not pending", 400));
    }

    const project = request.project;

    // Fetch MAIN warehouses to deduct stock from
    const mainWarehouses = await mongoose.model("Warehouse").find({ type: "MAIN" }).select("_id");
    const mainWarehouseIds = mainWarehouses.map(w => w._id);

    // 1. Process each item
    for (const item of request.items) {
        // A. Find Stock in MAIN warehouses
        const stock = await Inventory.findOne({ 
            material: item.material, 
            warehouse: { $in: mainWarehouseIds },
            quantity: { $gte: item.quantity }
        });

        if (!stock) {
            return next(new AppError(`Insufficient stock in main warehouses for material ${item.material}`, 400));
        }

        // B. Transfer & Issue Logic
        if (project.warehouseType === "DEDICATED" && project.dedicatedWarehouse) {
            // STEP 1: Transfer from MAIN to DEDICATED
            stock.quantity -= item.quantity;
            await stock.save();

            // Create TRANSFER transaction (optional, to log the movement)
            await MaterialTransaction.create({
                project: project._id,
                material: item.material,
                quantity: item.quantity,
                type: "ISSUE", // Can be "TRANSFER" if supported, but preserving schema valid enum
                warehouse: project.dedicatedWarehouse,
                referenceRequest: request._id,
                createdBy: userId
            });

            // Add to DEDICATED inventory
            const dedicatedStock = await Inventory.findOneAndUpdate(
                { material: item.material, warehouse: project.dedicatedWarehouse },
                { $inc: { quantity: item.quantity }, $set: { lastUpdated: new Date() } },
                { upsert: true, new: true }
            );

            // STEP 2: Issue from DEDICATED
            dedicatedStock.quantity -= item.quantity;
            await dedicatedStock.save();

            await MaterialTransaction.create({
                project: project._id,
                material: item.material,
                phase: request.phase || null,
                quantity: item.quantity,
                type: "ISSUE",
                warehouse: project.dedicatedWarehouse,
                referenceRequest: request._id,
                createdBy: userId
            });

        } else {
            // Direct Issue from MAIN
            stock.quantity -= item.quantity;
            await stock.save();

            await MaterialTransaction.create({
                project: project._id,
                material: item.material,
                phase: request.phase || null,
                quantity: item.quantity,
                type: "ISSUE",
                warehouse: stock.warehouse, // The main warehouse it was taken from
                referenceRequest: request._id,
                createdBy: userId
            });
        }

        // C. Update Project Material (Issued Quantity)
        await ProjectMaterial.findOneAndUpdate(
            { project: project._id, material: item.material },
            { $inc: { issuedQuantity: item.quantity } },
            { upsert: true }
        );
    }

    // 2. Update Request Status
    request.status = "APPROVED";
    request.approvedBy = userId;
    await request.save();

    return res.status(200).json({
        success: true,
        message: "Request approved and materials issued",
        data: request
    });
});

/**
 * GET INVENTORY
 */
export const getInventory = asynchandler(async (req, res, next) => {
    const stock = await Inventory.find().populate("material", "name unit");
    return res.status(200).json({
        success: true,
        data: stock
    });
});

/**
 * GET TRANSACTIONS
 */
export const getTransactions = asynchandler(async (req, res, next) => {
    const transactions = await MaterialTransaction.find()
        .populate("project", "name")
        .populate("material", "name unit")
        .populate("createdBy", "username")
        .sort({ transactionDate: -1 });

    return res.status(200).json({
        success: true,
        data: transactions
    });
});
