import Material from "../../db/models/metrials/metrials.js";
import RFQ from "../../db/models/procurement/rfq.model.js";
import PurchaseOrder from "../../db/models/procurement/purchaseOrder.model.js";
import Inventory from "../../db/models/inventory.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { emitToManagers, emitInventoryUpdate } from "../../utils/socket.js";

/**
 * 1. CREATE RFQ — notifies managers
 */
export const createRFQ = asynchandler(async (req, res, next) => {
    const { items, deadline } = req.body;

    for (const item of items) {
        const materialExists = await Material.findById(item.material);
        if (!materialExists) return next(new AppError(`Material ID ${item.material} not found`, 404));
    }

    const rfq = await RFQ.create({
        items,
        deadline,
        createdBy: req.user._id,
        status: "SENT"
    });

    // 🔔 Notify managers: new RFQ created
    emitToManagers('inventory:rfq_created', {
        rfqId: rfq._id,
        itemsCount: items.length,
        deadline,
        createdBy: req.user._id,
        timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: "RFQ created successfully", data: rfq });
});

/**
 * 2. CREATE PURCHASE ORDER — notifies managers
 */
export const createPO = asynchandler(async (req, res, next) => {
    const { rfqId, supplierId, items } = req.body;

    const rfq = await RFQ.findById(rfqId);
    if (!rfq) return next(new AppError("RFQ not found", 404));

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const po = await PurchaseOrder.create({
        rfq: rfqId,
        supplier: supplierId,
        items,
        totalAmount,
        createdBy: req.user._id,
        status: "APPROVED"
    });

    rfq.status = "CLOSED";
    await rfq.save();

    // 🔔 Notify managers: new PO approved
    emitToManagers('approval:approved', {
        type: 'PURCHASE_ORDER',
        poId: po._id,
        totalAmount,
        supplierId,
        timestamp: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: "Purchase Order created", data: po });
});

/**
 * 3. RECEIVE GOODS — updates inventory + broadcasts live inventory update
 */
export const receiveGoods = asynchandler(async (req, res, next) => {
    const { poId } = req.params;

    const po = await PurchaseOrder.findById(poId).populate("items.material", "name unit");
    if (!po) return next(new AppError("PO not found", 404));
    if (po.status === "RECEIVED") return next(new AppError("PO already received", 400));

    for (const item of po.items) {
        const inv = await Inventory.findOneAndUpdate(
            { material: item.material._id || item.material },
            { $inc: { quantity: item.quantity }, $set: { lastUpdated: new Date() } },
            { upsert: true, new: true }
        );

        // 📦 Broadcast live inventory update to all connected clients
        emitInventoryUpdate({
            materialId: String(item.material._id || item.material),
            materialName: item.material.name || 'Unknown',
            newQuantity: inv?.quantity,
            added: item.quantity,
            source: 'GOODS_RECEIVED',
            poId: po._id,
            timestamp: new Date().toISOString(),
        });
    }

    po.status = "RECEIVED";
    await po.save();

    // 🔔 Notify managers: shipment received
    emitToManagers('inventory:updated', {
        type: 'GOODS_RECEIVED',
        poId: po._id,
        itemsCount: po.items.length,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Goods received and Inventory updated", data: po });
});

export const getRFQs = asynchandler(async (req, res, next) => {
    const rfqs = await RFQ.find()
        .populate("createdBy", "name email")
        .populate("items.material", "name unit");
    return res.status(200).json({ success: true, data: rfqs });
});

export const getPOs = asynchandler(async (req, res, next) => {
    const pos = await PurchaseOrder.find()
        .populate("items.material", "name unit")
        .populate("supplier", "name");
    res.status(200).json({ success: true, data: pos });
});
