/**
 * Procurement Flow Integration Test
 * RFQ → Quote → Select (auto PO) → Receive Goods
 *
 * Run: node --experimental-vm-modules src/auto/procurement-test.js
 */

import mongoose from "mongoose";
import { connectDB } from "../db/db.connection.js";

// Models
import Material from "../db/models/metrials/metrials.js";
import Supplier from "../db/models/procurement/supplier.model.js";
import RFQ from "../db/models/procurement/rfq.model.js";
import Quote from "../db/models/procurement/quote.model.js";
import PurchaseOrder from "../db/models/procurement/purchaseOrder.model.js";
import Inventory from "../db/models/inventory.js";
import MaterialCategory from "../db/models/settings/materialCategory.model.js";
import MeasurementUnit from "../db/models/settings/measurementUnit.model.js";
import User from "../db/models/user.js";

const log = (step, msg) => console.log(`\n[${step}] ${msg}`);
const ok  = (msg) => console.log(`  ✅ ${msg}`);
const err = (msg) => console.error(`  ❌ ${msg}`);

// IDs created during the test — collected for cleanup
const created = { materialId: null, supplierId: null, rfqId: null, quoteId: null, poId: null };

async function runTest() {
    console.log("=".repeat(60));
    console.log("  PROCUREMENT FLOW — INTEGRATION TEST");
    console.log("=".repeat(60));

    await connectDB();

    try {
        // ─── STEP 0: Find prerequisite data ────────────────────────────
        log("0", "Looking for prerequisite data (category, unit, user)...");

        const category = await MaterialCategory.findOne();
        if (!category) throw new Error("No MaterialCategory found — run seed first");
        ok(`MaterialCategory: ${category.name || category._id}`);

        const unit = await MeasurementUnit.findOne();
        if (!unit) throw new Error("No MeasurementUnit found — run seed first");
        ok(`MeasurementUnit: ${unit.name || unit._id}`);

        const user = await User.findOne({ isActive: true });
        if (!user) throw new Error("No active User found — run seed first");
        ok(`User: ${user.name} (${user._id})`);

        // ─── STEP 1: Create a test Material ────────────────────────────
        log("1", "Creating test Material...");
        const material = await Material.create({
            name: `TEST_MATERIAL_${Date.now()}`,
            category: category._id,
            unit: unit._id,
            standardCost: 100,
            alertQuantity: 5
        });
        created.materialId = material._id;
        ok(`Material created: ${material.name} (${material._id})`);

        // ─── STEP 2: Create a test Supplier ────────────────────────────
        log("2", "Creating test Supplier...");
        const supplier = await Supplier.create({
            name: `TEST_SUPPLIER_${Date.now()}`,
            contactPerson: "Ahmed Test",
            email: "test-supplier@zmsco.com",
            phone: "01000000000",
            materials: [material._id]
        });
        created.supplierId = supplier._id;
        ok(`Supplier created: ${supplier.name} (${supplier._id})`);

        // ─── STEP 3: Create RFQ ─────────────────────────────────────────
        log("3", "Creating RFQ...");
        const rfq = await RFQ.create({
            items: [{ material: material._id, quantity: 50 }],
            suppliers: [supplier._id],
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
            status: "SENT",
            createdBy: user._id
        });
        created.rfqId = rfq._id;
        ok(`RFQ created: ${rfq._id}  status=${rfq.status}`);

        // ─── STEP 4: Supplier Submits Quote ────────────────────────────
        log("4", "Supplier submitting Quote...");
        const quote = await Quote.create({
            rfq: rfq._id,
            supplier: supplier._id,
            items: [{
                material: material._id,
                quantity: 50,
                unitPrice: 95,        // cheaper than standard cost
                description: "Bulk offer"
            }],
            deliveryDays: 14,
            paymentTerms: "Net 30",
            validityDays: 30,
            notes: "Test quote",
            submittedAt: new Date(),
            status: "PENDING"
        });
        created.quoteId = quote._id;
        ok(`Quote created: ${quote._id}  totalAmount=${quote.totalAmount}`);

        // ─── STEP 5: Select Quote → auto-create PO ─────────────────────
        log("5", "Selecting Quote (auto PO creation)...");

        // Reject others & mark this one SELECTED
        await Quote.updateMany({ rfq: rfq._id, _id: { $ne: quote._id } }, { status: "REJECTED" });
        quote.status = "SELECTED";
        await quote.save();

        // Build PO items (safe null-guard)
        const populatedQuote = await Quote.findById(quote._id).populate("items.material", "name unit");
        const poItems = populatedQuote.items
            .filter(item => {
                if (!item.material) { console.warn("  ⚠️  Skipping null material"); return false; }
                return true;
            })
            .map(item => ({
                material: item.material._id || item.material,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }));

        if (poItems.length === 0) throw new Error("No valid items for PO — all material refs are null");

        const po = await PurchaseOrder.create({
            rfq: rfq._id,
            quote: quote._id,
            supplier: supplier._id,
            items: poItems,
            totalAmount: populatedQuote.totalAmount,
            deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            paymentTerms: "Net 30",
            createdBy: user._id,
            status: "APPROVED"
        });
        created.poId = po._id;

        // Close the RFQ
        rfq.status = "CLOSED";
        await rfq.save();

        ok(`PO created: ${po._id}  totalAmount=${po.totalAmount}`);
        ok(`RFQ closed: status=${rfq.status}`);

        // ─── STEP 6: Receive Goods → update Inventory ──────────────────
        log("6", "Receiving Goods (updating Inventory)...");

        if (po.status === "RECEIVED") throw new Error("PO already received");

        for (const item of po.items) {
            if (!item.material) { console.warn("  ⚠️  Skipping null material in receive"); continue; }
            const materialId = item.material._id || item.material;

            const inv = await Inventory.findOneAndUpdate(
                { material: materialId },
                { $inc: { quantity: item.quantity }, $set: { lastUpdated: new Date() } },
                { upsert: true, new: true }
            );
            ok(`Inventory updated — material: ${materialId}  new qty: ${inv.quantity}`);
        }

        po.status = "RECEIVED";
        await po.save();
        ok(`PO status → RECEIVED`);

        // ─── STEP 7: Verify ─────────────────────────────────────────────
        log("7", "Verifying final state...");
        const finalRFQ = await RFQ.findById(rfq._id);
        const finalQuote = await Quote.findById(quote._id);
        const finalPO = await PurchaseOrder.findById(po._id);
        const finalInv = await Inventory.findOne({ material: material._id });

        console.log(`\n  📋 Final State:`);
        console.log(`     RFQ status   : ${finalRFQ.status}     (expected: CLOSED)`);
        console.log(`     Quote status : ${finalQuote.status}   (expected: SELECTED)`);
        console.log(`     PO status    : ${finalPO.status}      (expected: RECEIVED)`);
        console.log(`     Inventory qty: ${finalInv?.quantity}  (expected: 50)`);

        const allPassed =
            finalRFQ.status === "CLOSED" &&
            finalQuote.status === "SELECTED" &&
            finalPO.status === "RECEIVED" &&
            finalInv?.quantity >= 50;

        console.log(`\n  ${allPassed ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`);

    } catch (e) {
        err(`Test failed: ${e.message}`);
        console.error(e);
    } finally {
        // ─── CLEANUP ────────────────────────────────────────────────────
        log("CLEANUP", "Removing test data...");
        if (created.poId)       { await PurchaseOrder.findByIdAndDelete(created.poId);   console.log("  🗑  PO deleted"); }
        if (created.quoteId)    { await Quote.findByIdAndDelete(created.quoteId);         console.log("  🗑  Quote deleted"); }
        if (created.rfqId)      { await RFQ.findByIdAndDelete(created.rfqId);             console.log("  🗑  RFQ deleted"); }
        if (created.supplierId) { await Supplier.findByIdAndDelete(created.supplierId);   console.log("  🗑  Supplier deleted"); }
        if (created.materialId) {
            await Inventory.deleteOne({ material: created.materialId });
            await Material.findByIdAndDelete(created.materialId);
            console.log("  🗑  Material + Inventory deleted");
        }

        await mongoose.disconnect();
        console.log("\n" + "=".repeat(60));
        console.log("  TEST FINISHED");
        console.log("=".repeat(60));
        process.exit(0);
    }
}

runTest();
