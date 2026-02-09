import mongoose from "mongoose";
import dotenv from "dotenv";
import Supplier from "../db/models/procurement/supplier.model.js";

dotenv.config();

const suppliers = [
    {
        name: "El-Ezz Steel",
        email: "sales@elezz.com",
        phone: "+201000000001",
        category: "Steel",
        address: "Cairo, Egypt"
    },
    {
        name: "Lafarge Cement",
        email: "contact@lafarge.eg",
        phone: "+201200000002",
        category: "Cement",
        address: "Alexandria, Egypt"
    },
    {
        name: "Giza Cables",
        email: "info@gizacables.com",
        phone: "+201100000003",
        category: "Electrical",
        address: "Giza, Egypt"
    }
];

const seedSuppliers = async () => {
    try {
        await mongoose.connect(process.env.URL_DATABASE);
        console.log("🔌 DB Connected");

        for (const supplier of suppliers) {
            await Supplier.updateOne(
                { email: supplier.email },
                { $set: supplier },
                { upsert: true }
            );
        }

        console.log("✅ Suppliers seeded successfully!");
        process.exit();
    } catch (error) {
        console.error("❌ Error seeding suppliers:", error);
        process.exit(1);
    }
};

seedSuppliers();
