import mongoose from "mongoose";
import dotenv from "dotenv";
import Material from "./src/db/models/metrials/metrials.js"; // Adjust path if needed

dotenv.config();

const MATERIAL_ID = "698616e42bef7db9b0f2319f"; // From your screenshot

const run = async () => {
    await mongoose.connect(process.env.URL_DATABASE);
    console.log("Connected to DB...");

    const material = await Material.findById(MATERIAL_ID);

    if (material) {
        console.log("✅ Material FOUND:", material.name);
    } else {
        console.log("❌ Material NOT FOUND for ID:", MATERIAL_ID);
        console.log("Check if this ID belongs to 'Inventory' or 'ProjectMaterial' instead?");
    }

    process.exit();
};

run();
