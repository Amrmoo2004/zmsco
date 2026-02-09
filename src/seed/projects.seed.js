import mongoose from "mongoose";
import dotenv from "dotenv";
import ProjectTemplate from "../db/models/projects/project.template.js";
import Material from "../db/models/metrials/metrials.js";

dotenv.config();
await mongoose.connect(process.env.URL_DATABASE);

// 1. Seed Dependency Materials
const materials = [
    { name: "Cement", unit: "Bags" }
];

for (const mat of materials) {
    await Material.updateOne(
        { name: mat.name },
        { $set: mat },
        { upsert: true }
    );
    console.log(`✅ Material '${mat.name}' seeded.`);
}

// 2. Seed Project Template
import Role from "../db/models/roles.js";
const siteManagerRole = await Role.findOne({ name: "SITE_ENGINEER" }); // Assuming we map Site Manager -> SITE_ENGINEER

const template = {
    name: "Standard Infrastructure",
    type: "INFRASTRUCTURE",
    phases: [
        { name: "Planning", order: 1 },
        { name: "Execution", order: 2 }
    ],
    materials: [
        { name: "Cement", unit: "Bags", defaultQuantity: 100 }
    ],
    equipments: [
        { name: "Excavator", unit: "Piece", defaultQuantity: 1 }
    ],
    attachments: [
        { name: "Safety Plan", required: true }
    ],
    employees: [
        { role: "Site Manager", defaultCount: 1, systemRole: siteManagerRole?._id }
    ],
    isActive: true
};

await ProjectTemplate.updateOne(
    { name: template.name },
    { $set: template },
    { upsert: true }
);

console.log("✅ Project Template seeded successfully");
process.exit();
