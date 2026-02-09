import mongoose from "mongoose";
import dotenv from "dotenv";
import Inventory from "../db/models/inventory.js";
import Material from "../db/models/metrials/metrials.js";

import Warehouse from "../db/models/warehouse.model.js";

dotenv.config();
await mongoose.connect(process.env.URL_DATABASE);

// 1. Create/Find Main Warehouse
const mainWarehouse = await Warehouse.findOneAndUpdate(
    { name: "Main Central Warehouse" },
    { type: "MAIN", location: "Cairo HQ" },
    { upsert: true, new: true }
);

console.log(`🏭 Main Warehouse ID: ${mainWarehouse._id}`);

// 2. Find Cement Material
const cement = await Material.findOne({ name: "Cement" });

if (!cement) {
    console.error("❌ Material 'Cement' not found. Run projects.seed.js first.");
    process.exit(1);
}

// 3. Upsert Inventory (Linked to Main Warehouse)
await Inventory.updateOne(
    { material: cement._id, warehouse: mainWarehouse._id },
    {
        $set: {
            quantity: 1000,
            lastUpdated: new Date()
        }
    },
    { upsert: true }
);

console.log("✅ Inventory seeded: 1000 Bags of Cement");
process.exit();
