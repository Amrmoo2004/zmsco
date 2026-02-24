import Quote from "../../db/models/procurement/quote.model.js";
import PurchaseOrder from "../../db/models/procurement/purchaseOrder.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/rfqs/:rfqId/quotes — Get all quotes for an RFQ (comparison view)
export const getQuotesByRFQ = asynchandler(async (req, res) => {
    const quotes = await Quote.find({ rfq: req.params.rfqId })
        .populate("supplier", "name contactPerson email phone")
        .populate("items.material", "name unit")
        .sort({ totalAmount: 1 });
    return res.status(200).json({ success: true, data: quotes });
});

// POST /api/rfqs/:rfqId/quotes — Submit a quote (by supplier or admin)
export const submitQuote = asynchandler(async (req, res) => {
    const { supplier, items, deliveryDays, paymentTerms, validityDays, notes } = req.body;
    const quote = new Quote({
        rfq: req.params.rfqId,
        supplier, items, deliveryDays, paymentTerms, validityDays, notes,
        submittedAt: new Date()
    });
    await quote.save(); // triggers pre-save for total calculation
    return res.status(201).json({ success: true, message: "Quote submitted", data: quote });
});

// PUT /api/quotes/:id/select — Select winning quote and create PO
export const selectQuote = asynchandler(async (req, res, next) => {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return next(new AppError("Quote not found", 404));

    // Reject all other quotes for this RFQ
    await Quote.updateMany(
        { rfq: quote.rfq, _id: { $ne: quote._id } },
        { status: "REJECTED" }
    );
    quote.status = "SELECTED";
    await quote.save();

    return res.status(200).json({ success: true, message: "Quote selected", data: quote });
});

// DELETE /api/quotes/:id
export const deleteQuote = asynchandler(async (req, res, next) => {
    const quote = await Quote.findByIdAndDelete(req.params.id);
    if (!quote) return next(new AppError("Quote not found", 404));
    return res.status(200).json({ success: true, message: "Quote deleted" });
});
