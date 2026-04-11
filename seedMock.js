import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import JobTitle from "./src/db/models/settings/jobTitle.model.js";
import Department from "./src/db/models/settings/department.model.js";
import MeasurementUnit from "./src/db/models/settings/measurementUnit.model.js";
import MaterialCategory from "./src/db/models/settings/materialCategory.model.js";
import User from "./src/db/models/user.js";
import Role from "./src/db/models/roles.js";
import Material from "./src/db/models/metrials/metrials.js"; 
import { Equipment } from "./src/db/models/hr/equipment.model.js";
import Warehouse from "./src/db/models/warehouse.model.js";
import Inventory from "./src/db/models/inventory.js";
import ProjectType from "./src/db/models/settings/projectType.model.js";
import { connectDB } from "./src/db/db.connection.js";

const seed = async () => {
    try {
        await connectDB();
        console.log("Seeding started...");

        // Drop old non-existent field indexes to prevent E11000 errors on legacy fields
        try { await Department.collection.dropIndex("name_1"); } catch(e){}
        try { await JobTitle.collection.dropIndex("title_1"); } catch(e){}

        // 1. Ensure a basic Role exists for our dummy users
        let role = await Role.findOne({ name: "Worker" });
        if (!role) {
            role = await Role.create({ name: "Worker", permissions: ["BASIC"] });
        }

        // 2. Department
        let department = await Department.findOne({ code: "ENG-01" });
        if (!department) {
            department = await Department.create({ name: `القسم الهندسي ${Date.now()}`, nameAr: "القسم الهندسي", nameEn: "Engineering Department", code: "ENG-01" });
        }

        // 3. Job Titles
        const jobsToInsert = [
            { nameAr: "مهندس مدني", nameEn: "Civil Engineer", code: `ENG-CIV-${Date.now()}`, estimatedDailyCost: 400, department: department._id },
            { nameAr: "عامل بناء", nameEn: "Construction Worker", code: `WK-B-${Date.now()}`, estimatedDailyCost: 150, department: department._id },
            { nameAr: "مدير مشروع", nameEn: "Project Manager", code: `PM-${Date.now()}`, estimatedDailyCost: 800, department: department._id }
        ];
        const createdJobs = await JobTitle.insertMany(jobsToInsert);
        console.log("✅ JobTitles seeded: ", createdJobs.length);

        // 3. Users (Employees)
        const rawPass = "password123";
        const hashedPass = bcrypt.hashSync(rawPass, 10);
        const usersToInsert = [
            { name: "Ahmed Civil", email: `ahmed${Date.now()}@test.com`, password: hashedPass, role: role._id, jobTitle: createdJobs[0]._id },
            { name: "Ali Worker", email: `ali${Date.now()}@test.com`, password: hashedPass, role: role._id, jobTitle: createdJobs[1]._id },
            { name: "Manager Mahmoud", email: `mah${Date.now()}@test.com`, password: hashedPass, role: role._id, jobTitle: createdJobs[2]._id },
        ];
        await User.insertMany(usersToInsert);
        console.log("✅ Users/Employees seeded: ", usersToInsert.length);

        // 4. Materials setup (Category and Unit)
        let unitTon = await MeasurementUnit.findOne({ nameAr: "طن" });
        if (!unitTon) unitTon = await MeasurementUnit.create({ nameAr: "طن", nameEn: "Ton", abbreviation: "t", type: "وزن", code: "TN" });

        let unitThousand = await MeasurementUnit.findOne({ nameAr: "ألف" });
        if (!unitThousand) unitThousand = await MeasurementUnit.create({ nameAr: "ألف", nameEn: "Thousand", abbreviation: "K", type: "عدد", code: "THOU" });

        let categoryCement = await MaterialCategory.findOne({ nameEn: "Cement" });
        if (!categoryCement) categoryCement = await MaterialCategory.create({ nameAr: "أسمنت", nameEn: "Cement", code: "CMNT" });

        let categorySteel = await MaterialCategory.findOne({ nameEn: "Steel" });
        if (!categorySteel) categorySteel = await MaterialCategory.create({ nameAr: "حديد", nameEn: "Steel", code: "STEL" });

        let categoryBricks = await MaterialCategory.findOne({ nameEn: "Bricks" });
        if (!categoryBricks) categoryBricks = await MaterialCategory.create({ nameAr: "طوب", nameEn: "Bricks", code: "BRCK" });

        const materialsToInsert = [
            { name: `أسمنت بورتلاندي ${Date.now()}`, unit: unitTon._id, category: categoryCement._id, minStock: 10, standardCost: 1200 },
            { name: `حديد تسليح 12ملي ${Date.now()}`, unit: unitTon._id, category: categorySteel._id, minStock: 5, standardCost: 25000 },
            { name: `طوب أحمر ${Date.now()}`, unit: unitThousand._id, category: categoryBricks._id, minStock: 20, standardCost: 1500 }
        ];
        const createdMaterials = await Material.insertMany(materialsToInsert);
        console.log("✅ Materials seeded: ", createdMaterials.length);

        // 5. Equipment
        const equipmentsToInsert = [
            { name: `رافعة 50 طن ${Date.now()}`, type: "Crane", brand: "Caterpillar", dailyCost: 2000, condition: "GOOD" },
            { name: `خلاطة خرسانة ${Date.now()}`, type: "Mixer", brand: "Volvo", dailyCost: 500, condition: "EXCELLENT" },
            { name: `مولد كهرباء 100KVA ${Date.now()}`, type: "Generator", brand: "Honda", dailyCost: 300, condition: "GOOD" }
        ];
        await Equipment.insertMany(equipmentsToInsert);
        console.log("✅ Equipments seeded: ", equipmentsToInsert.length);

        // 6. Main Warehouse & Inventory Setup
        // Check if there is any MAIN warehouse to inject inventory in
        let mainWarehouse = await Warehouse.findOne({ type: "MAIN" });
        if (!mainWarehouse) {
            mainWarehouse = await Warehouse.create({ name: "المستودع المركزي", type: "MAIN", location: "المنطقة الصناعية", capacity: 10000 });
            console.log("✅ Main Warehouse created");
        }

        // Add 5000 units of each created material into the main warehouse
        const inventoryData = createdMaterials.map(mat => ({
            material: mat._id,
            warehouse: mainWarehouse._id,
            quantity: 5000,
            lastUpdated: new Date()
        }));
        await Inventory.insertMany(inventoryData);
        console.log("✅ Inventory seeded: Added 5000 units for each material in Main Warehouse");

        // 7. Project Blueprint (Type) Setup
        const projectTypeCode = "PT-RES-01";
        let defaultProjectType = await ProjectType.findOne({ code: projectTypeCode });
        if (!defaultProjectType) {
            defaultProjectType = await ProjectType.create({
                name: "مجمع سكني قياسي",
                nameAr: "مجمع سكني قياسي",
                nameEn: "Standard Residential Complex",
                code: projectTypeCode,
                description: "قالب افتراضي لإنشاء المجمعات السكنية مع المراحل والموارد",
                category: "إنشاءات",
                phases: [
                    { nameAr: "التخطيط", nameEn: "Planning", name: "Planning", order: 1, expectedDays: 15, color: "#3498db" },
                    { nameAr: "التصميم", nameEn: "Design", name: "Design", order: 2, expectedDays: 30, color: "#9b59b6" },
                    { nameAr: "التنفيذ", nameEn: "Execution", name: "Execution", order: 3, expectedDays: 120, color: "#f1c40f" },
                    { nameAr: "الإغلاق", nameEn: "Closure", name: "Closure", order: 4, expectedDays: 10, color: "#2ecc71" }
                ],
                defaultResources: {
                    employees: [
                        { jobTitle: createdJobs[0]._id, count: 2 }, // Engineers
                        { jobTitle: createdJobs[1]._id, count: 10 } // Workers
                    ],
                    materials: [
                        { material: createdMaterials[0]._id, quantity: 100 }, // Cement
                        { material: createdMaterials[1]._id, quantity: 50 }  // Steel
                    ],
                    equipments: [
                        { name: equipmentsToInsert[0].name, count: 1, unit: "وحدة", estimatedDailyCost: 2000 },
                        { name: equipmentsToInsert[1].name, count: 2, unit: "معدة", estimatedDailyCost: 500 }
                    ]
                }
            });
            console.log("✅ Project blueprint (ProjectType) created with default phases and resources.");
        }

        console.log("🎉 All seeding completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seed();
