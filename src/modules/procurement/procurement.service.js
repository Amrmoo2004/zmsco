import Material from "../../db/models/metrials/metrials.js";
import RFQ from "../../db/models/procurement/rfq.model.js";
import Quote from "../../db/models/procurement/quote.model.js";
import PurchaseOrder from "../../db/models/procurement/purchaseOrder.model.js";
import Inventory from "../../db/models/inventory.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { emitToManagers, emitInventoryUpdate } from "../../utils/socket.js";

/**
 * 1. CREATE RFQ — notifies managers
 */
export const createRFQ = asynchandler(async (req, res, next) => {
    const { items, deadline, suppliers, project, phase, warehouse } = req.body;

    for (const item of items) {
        const materialExists = await Material.findById(item.material);
        if (!materialExists) return next(new AppError(`Material ID ${item.material} not found`, 404));
    }

    const rfq = await RFQ.create({
        items,
        deadline,
        suppliers: suppliers || [],
        project: project || undefined,
        phase: phase || undefined,
        warehouse: warehouse || undefined,
        createdBy: req.user._id,
        status: "SENT"
    });

    await rfq.populate("items.material", "name unit");
    await rfq.populate("suppliers", "name contactPerson phone email");

    // 🔔 Notify managers: new RFQ created
    emitToManagers('inventory:rfq_created', {
        rfqId: rfq._id,
        itemsCount: items.length,
        deadline,
        suppliersCount: (suppliers || []).length,
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

    // Attach quotes count to each RFQ
    const rfqIds = rfqs.map(r => r._id);
    const quotesAgg = await Quote.aggregate([
        { $match: { rfq: { $in: rfqIds } } },
        { $group: { _id: "$rfq", count: { $sum: 1 } } }
    ]);
    const quotesCountMap = {};
    quotesAgg.forEach(q => { quotesCountMap[String(q._id)] = q.count; });

    const rfqsWithCount = rfqs.map(r => ({
        ...r.toObject(),
        quotesCount: quotesCountMap[String(r._id)] || 0
    }));

    return res.status(200).json({ success: true, data: rfqsWithCount });
});

export const getPOs = asynchandler(async (req, res, next) => {
    const { project } = req.query;
    const filter = {};
    if (project) filter.project = project;

    const pos = await PurchaseOrder.find(filter)
        .populate("items.material", "name unit")
        .populate("supplier", "name contactPerson phone")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: pos });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * 4. SUBMIT QUOTE — المورد يبعت عرض سعر على RFQ معين
 * POST /procurement/rfq/:rfqId/quotes
 */
export const submitQuote = asynchandler(async (req, res, next) => {
    const { rfqId } = req.params;
    const { supplierId, items, deliveryDays, paymentTerms, validityDays, notes } = req.body;

    const rfq = await RFQ.findById(rfqId);
    if (!rfq) return next(new AppError("RFQ not found", 404));
    if (rfq.status === "CLOSED") return next(new AppError("RFQ is already closed", 400));

    // Check if supplier already submitted a quote for this RFQ
    const existingQuote = await Quote.findOne({ rfq: rfqId, supplier: supplierId });
    if (existingQuote) return next(new AppError("This supplier already submitted a quote for this RFQ", 400));

    const quote = await Quote.create({
        rfq: rfqId,
        supplier: supplierId,
        items,
        deliveryDays,
        paymentTerms,
        validityDays,
        notes,
        submittedAt: new Date(),
        status: "PENDING"
    });

    await quote.populate("supplier", "name contactPerson phone email");
    await quote.populate("items.material", "name unit");

    // Notify managers: new quote submitted
    emitToManagers("procurement:quote_submitted", {
        rfqId,
        quoteId: quote._id,
        supplierId,
        totalAmount: quote.totalAmount,
        timestamp: new Date().toISOString()
    });

    return res.status(201).json({ success: true, message: "Quote submitted successfully", data: quote });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * 5. GET QUOTES for an RFQ — لعرض العروض والمقارنة
 * GET /procurement/rfq/:rfqId/quotes
 */
export const getRFQQuotes = asynchandler(async (req, res, next) => {
    const { rfqId } = req.params;

    const rfq = await RFQ.findById(rfqId)
        .populate("items.material", "name unit")
        .populate("suppliers", "name contactPerson phone email");
    if (!rfq) return next(new AppError("RFQ not found", 404));

    const quotes = await Quote.find({ rfq: rfqId })
        .populate("supplier", "name contactPerson phone email rating")
        .populate("items.material", "name unit")
        .sort({ totalAmount: 1 }); // مرتبة من الأرخص للأغلى

    // Add comparison metadata
    const amounts = quotes.map(q => q.totalAmount);
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

    const quotesWithMeta = quotes.map(q => ({
        ...q.toObject(),
        isBestPrice: q.totalAmount === minAmount,
        isWorstPrice: q.totalAmount === maxAmount && quotes.length > 1,
        savingsVsBest: q.totalAmount - minAmount
    }));

    return res.status(200).json({
        success: true,
        data: {
            rfq,
            quotes: quotesWithMeta,
            summary: {
                totalQuotes: quotes.length,
                bestPrice: minAmount,
                worstPrice: maxAmount,
                averagePrice: quotes.length > 0
                    ? Math.round(amounts.reduce((a, b) => a + b, 0) / quotes.length)
                    : 0
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * 6. SELECT QUOTE — اختيار عرض سعر وإنشاء PO أوتوماتيك
 * PATCH /procurement/rfq/:rfqId/quotes/:quoteId/select
 */
export const selectQuote = asynchandler(async (req, res, next) => {
    const { rfqId, quoteId } = req.params;
    const { deliveryDate, paymentTerms, warehouse } = req.body;

    const rfq = await RFQ.findById(rfqId);
    if (!rfq) return next(new AppError("RFQ not found", 404));
    if (rfq.status === "CLOSED") return next(new AppError("RFQ is already closed", 400));

    const selectedQuote = await Quote.findById(quoteId).populate("items.material", "name unit");
    if (!selectedQuote) return next(new AppError("Quote not found", 404));
    if (String(selectedQuote.rfq) !== String(rfqId))
        return next(new AppError("Quote does not belong to this RFQ", 400));

    // Reject all other quotes for this RFQ
    await Quote.updateMany(
        { rfq: rfqId, _id: { $ne: quoteId } },
        { status: "REJECTED" }
    );

    // Select this quote
    selectedQuote.status = "SELECTED";
    await selectedQuote.save();

    // Auto-create PO from selected quote
    const po = await PurchaseOrder.create({
        rfq: rfqId,
        quote: quoteId,
        supplier: selectedQuote.supplier,
        project: rfq.project,
        warehouse: warehouse || rfq.warehouse,
        items: selectedQuote.items.map(item => ({
            material: item.material._id || item.material,
            quantity: item.quantity,
            unitPrice: item.unitPrice
        })),
        totalAmount: selectedQuote.totalAmount,
        deliveryDate: deliveryDate || undefined,
        paymentTerms: paymentTerms || selectedQuote.paymentTerms,
        createdBy: req.user._id,
        status: "APPROVED"
    });

    // Close the RFQ
    rfq.status = "CLOSED";
    await rfq.save();

    await po.populate("supplier", "name contactPerson phone");
    await po.populate("items.material", "name unit");

    // Notify managers
    emitToManagers("approval:approved", {
        type: "PURCHASE_ORDER",
        poId: po._id,
        totalAmount: po.totalAmount,
        supplierId: po.supplier,
        rfqId,
        quoteId,
        timestamp: new Date().toISOString()
    });

    return res.status(200).json({
        success: true,
        message: "Quote selected and Purchase Order created automatically",
        data: { quote: selectedQuote, purchaseOrder: po }
    });
});
