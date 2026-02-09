import Material from "../../db/models/metrials/metrials.js"; // Import Material
import RFQ from "../../db/models/procurement/rfq.model.js";
import PurchaseOrder from "../../db/models/procurement/purchaseOrder.model.js";
import Inventory from "../../db/models/inventory.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * 1. CREATE RFQ (Request for Quotation)
 * Triggered when stock is low.
 */
export const createRFQ = asynchandler(async (req, res, next) => {
    const { items, deadline } = req.body; // items: [{ material, quantity }]

    // Validate if materials exist
    for (const item of items) {
        const materialExists = await Material.findById(item.material);
        if (!materialExists) {
            return next(new AppError(`Material ID ${item.material} not found`, 404));
        }
    }

    const rfq = await RFQ.create({
        items,
        deadline,
        createdBy: req.user._id,
        status: "SENT" // Simplifying: directly SENT to suppliers
    });

    return res.status(201).json({
        success: true,
        message: "RFQ created successfully",
        data: rfq
    });
});

/**
 * 2. CREATE PURCHASE ORDER (PO)
 * Select a supplier and confirm order.
 */
export const createPO = asynchandler(async (req, res, next) => {
    const { rfqId, supplierId, items } = req.body; // items has prices

    // Validate RFQ
    const rfq = await RFQ.findById(rfqId);
    if (!rfq) return next(new AppError("RFQ not found", 404));

    // Calculate Total
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const po = await PurchaseOrder.create({
        rfq: rfqId,
        supplier: supplierId,
        items,
        totalAmount,
        createdBy: req.user._id,
        status: "APPROVED" // Ready to be sent
    });

    // Close RFQ
    rfq.status = "CLOSED";
    await rfq.save();

    return res.status(201).json({
        success: true,
        message: "Purchase Order created",
        data: po
    });
});

/**
 * 3. RECEIVE GOODS (The Magic Step)
 * Truck arrives -> Updates Inventory.
 */
export const receiveGoods = asynchandler(async (req, res, next) => {
    const { poId } = req.params;

    const po = await PurchaseOrder.findById(poId);
    if (!po) return next(new AppError("PO not found", 404));
    if (po.status === "RECEIVED") return next(new AppError("PO already received", 400));

    // Update Inventory
    for (const item of po.items) {
        await Inventory.updateOne(
            { material: item.material },
            {
                $inc: { quantity: item.quantity },
                $set: { lastUpdated: new Date() }
            },
            { upsert: true }
        );
    }

    // Update PO Status
    po.status = "RECEIVED";
    await po.save();

    return res.status(200).json({
        success: true,
        message: "Goods received and Inventory updated",
        data: po
    });
});

export const getRFQs = asynchandler(async (req, res, next) => {
  const rfqs = await RFQ.find()
    .populate("createdBy", "name email")          // لو عايز اسم اليوزر
    .populate("items.material", "name unit");     // 👈 هنا اسم الماتريال

  return res.status(200).json({
    success: true,
    data: rfqs  
  });
});

export const getPOs = asynchandler(async (req, res, next) => {
    const pos = await PurchaseOrder.find()
        .populate("items.material", "name unit")
        .populate("supplier", "name"); // Assuming Supplier model exists
    res.status(200).json({ success: true, data: pos });
});
