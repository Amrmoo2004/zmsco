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

    const request = await MaterialRequest.findById(requestId);
    if (!request) {
        return next(new AppError("Request not found", 404));
    }

    if (request.status !== "PENDING") {
        return next(new AppError("Request is not pending", 400));
    }

    // 1. Process each item
    for (const item of request.items) {
        // A. Check Stock
        const stock = await Inventory.findOne({ material: item.material });
        if (!stock || stock.quantity < item.quantity) {
            return next(new AppError(`Insufficient stock for material ${item.material}`, 400));
        }

        // B. Deduct Stock
        stock.quantity -= item.quantity;
        await stock.save();

        // C. Create Transaction
        await MaterialTransaction.create({
            project: request.project,
            material: item.material,
            quantity: item.quantity,
            type: "ISSUE",
            referenceRequest: request._id,
            createdBy: userId
        });

        // D. Update Project Material (Issued Quantity)
        // Find project material or create if not exists? Usually it exists from auto-setup.
        await ProjectMaterial.findOneAndUpdate(
            { project: request.project, material: item.material },
            { $inc: { issuedQuantity: item.quantity } }
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
