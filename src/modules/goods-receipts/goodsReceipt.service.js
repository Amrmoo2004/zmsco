import GoodsReceipt from "../../db/models/procurement/goodsReceipt.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/purchase-orders/:poId/receipts
export const getReceiptsByPO = asynchandler(async (req, res) => {
    const receipts = await GoodsReceipt.find({ po: req.params.poId })
        .populate("receivedBy", "name email")
        .populate("items.material", "name unit")
        .populate("warehouse", "name location")
        .sort({ receiptDate: -1 });
    return res.status(200).json({ success: true, data: receipts });
});

// POST /api/purchase-orders/:poId/receipts
export const createReceipt = asynchandler(async (req, res) => {
    const { items, deliveryNoteNumber, warehouse, notes } = req.body;
    const receipt = await GoodsReceipt.create({
        po: req.params.poId,
        receivedBy: req.user._id,
        receiptDate: new Date(),
        deliveryNoteNumber, items, warehouse, notes
    });
    return res.status(201).json({ success: true, message: "Goods receipt recorded", data: receipt });
});

// GET /api/purchase-orders/:poId/receipt-summary — Progress for the PO receipt bar
export const getReceiptSummary = asynchandler(async (req, res) => {
    const receipts = await GoodsReceipt.find({ po: req.params.poId });
    // Aggregate total received per material
    const receivedMap = {};
    receipts.forEach(r => {
        r.items.forEach(item => {
            const key = item.material?.toString();
            if (key) receivedMap[key] = (receivedMap[key] || 0) + item.receivedQuantity;
        });
    });
    return res.status(200).json({ success: true, data: { receivedMap, totalReceipts: receipts.length } });
});
