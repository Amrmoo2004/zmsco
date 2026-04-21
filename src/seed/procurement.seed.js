import mongoose from "mongoose";
import dotenv from "dotenv";
import Supplier from "../db/models/procurement/supplier.model.js";
import RFQ from "../db/models/procurement/rfq.model.js";
import Quote from "../db/models/procurement/quote.model.js";
import PurchaseOrder from "../db/models/procurement/purchaseOrder.model.js";
import Material from "../db/models/metrials/metrials.js";
import Project from "../db/models/projects/project.js";

dotenv.config();

const seedProcurement = async () => {
    try {
        await mongoose.connect(process.env.URL_DATABASE);
        console.log("🔌 DB Connected");

        // ─── 1. جلب بيانات موجودة فعلاً ───────────────────────────────────────
        const materials = await Material.find().limit(4).lean();
        if (materials.length < 2) {
            console.log("❌ لازم يكون في مواد في الداتابيز أولاً. شغّل inventory.seed.js");
            process.exit(1);
        }

        const project = await Project.findOne().lean();

        // ─── 2. إنشاء الموردين (upsert بدون مسح القديم) ─────────────────────
        const supplierData = [
            {
                name: "مؤسسة البناء الحديث",
                contactPerson: "أحمد محمد",
                phone: "0112345678",
                email: "info@modernbuild.sa",
                address: "الرياض، حي الصناعية",
                materials: materials.map(m => m._id)
            },
            {
                name: "شركة المواد المتحدة",
                contactPerson: "خالد العتيبي",
                phone: "0112345679",
                email: "sales@unitmats.sa",
                address: "جدة، المنطقة الصناعية",
                materials: materials.map(m => m._id)
            },
            {
                name: "مؤسسة الخليج للتجارة",
                contactPerson: "سعد الشمري",
                phone: "0112345680",
                email: "contact@gulftrade.sa",
                address: "الدمام، الحي التجاري",
                materials: materials.map(m => m._id)
            },
            {
                name: "شركة الإنشاءات المتقدمة",
                contactPerson: "فهد القحطاني",
                phone: "0112345681",
                email: "info@advcons.sa",
                address: "أبها، الملز",
                materials: materials.map(m => m._id)
            }
        ];

        const savedSuppliers = [];
        for (const s of supplierData) {
            const saved = await Supplier.findOneAndUpdate(
                { email: s.email },
                { $set: s },
                { upsert: true, new: true }
            );
            savedSuppliers.push(saved);
            console.log(`✅ Supplier: ${saved.name}`);
        }

        // ─── 3. إنشاء RFQ تجريبي ──────────────────────────────────────────────
        const existingRFQ = await RFQ.findOne({ "items.0": { $exists: true } });
        let rfq = existingRFQ;

        if (!existingRFQ) {
            rfq = await RFQ.create({
                items: materials.slice(0, 3).map(m => ({
                    material: m._id,
                    quantity: Math.floor(Math.random() * 50) + 10
                })),
                suppliers: savedSuppliers.map(s => s._id),
                project: project?._id,
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // بعد أسبوع
                status: "SENT",
                createdBy: null
            });
            console.log(`✅ RFQ created: ${rfq._id}`);
        } else {
            console.log(`ℹ️  RFQ موجود: ${rfq._id} — مش هنعمل جديد`);
        }

        // ─── 4. إنشاء Quotes (عروض أسعار) لكل مورد ─────────────────────────
        const quotePrices = [118000, 122000, 125000, 119500];
        const deliveryDays = [7, 10, 5, 12];
        const paymentTerms = ["30 يوم", "45 يوم", "60 يوم", "فوري"];

        for (let i = 0; i < savedSuppliers.length; i++) {
            const supplier = savedSuppliers[i];
            const existingQuote = await Quote.findOne({ rfq: rfq._id, supplier: supplier._id });
            if (existingQuote) {
                console.log(`ℹ️  عرض موجود للمورد: ${supplier.name}`);
                continue;
            }

            const items = rfq.items.map((item, idx) => {
                const unitPrice = Math.round((quotePrices[i] / rfq.items.length) / 100) * 100;
                return {
                    material: item.material,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice: item.quantity * unitPrice,
                    description: `صنف ${idx + 1} — عرض ${supplier.name}`
                };
            });

            const totalAmount = items.reduce((sum, it) => sum + it.totalPrice, 0);

            await Quote.collection.insertOne({
                rfq: rfq._id,
                supplier: supplier._id,
                items,
                totalAmount,
                deliveryDays: deliveryDays[i],
                paymentTerms: paymentTerms[i],
                validityDays: 30,
                notes: `عرض سعر من ${supplier.name}`,
                submittedAt: new Date(),
                status: "PENDING",
                createdAt: new Date(),
                updatedAt: new Date()
            });

            console.log(`✅ Quote من: ${supplier.name} — ${totalAmount.toLocaleString()} ريال`);
        }

        // ─── 5. طباعة ملخص للفرونت ────────────────────────────────────────────
        console.log("\n" + "=".repeat(60));
        console.log("📋 بيانات جاهزة للفرونت إند:");
        console.log("=".repeat(60));
        console.log(`🔹 RFQ ID:        ${rfq._id}`);
        console.log(`🔹 Project ID:    ${project?._id || "لا يوجد مشروع في الداتابيز"}`);
        console.log("🔹 Supplier IDs:");
        savedSuppliers.forEach(s => console.log(`   - ${s.name}: ${s._id}`));
        console.log("🔹 Material IDs:");
        materials.slice(0, 4).forEach(m => console.log(`   - ${m.name}: ${m._id}`));
        console.log("=".repeat(60));
        console.log("\n✅ الـ Seed اتعمل بنجاح من غير ما يمسح داتا قديمة!");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
};

seedProcurement();
