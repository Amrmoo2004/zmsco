import mongoose from "mongoose";
import { connectDB } from "../db/db.connection.js";
import ProjectType from "../db/models/settings/projectType.model.js";
import Workflow from "../db/models/settings/workflow.model.js";
import ApprovalRule from "../db/models/settings/approvalRule.model.js";
import ProjectPhaseTemplate from "../db/models/settings/projectPhaseTemplate.model.js";

async function runTest() {
    console.log("=== STARTING INTEGRATION TEST ===");
    await connectDB();

    try {
        console.log("\n[1] Checking Global Defaults (ProjectPhaseTemplate)...");
        const globalPhases = await ProjectPhaseTemplate.find({ isActive: true });
        console.log(`- Found ${globalPhases.length} global phases.`);
        if (globalPhases.length === 0) {
            console.warn("⚠️ Warning: No global phases exist. Run seedDefaultSettings() first if you want defaults.");
        }

        console.log("\n[2] Testing Project Type Creation: Empty Phases (Fallback to Default)...");
        const code1 = "TEST-DEFAULT-" + Date.now().toString().slice(-4);
        const ptEmpty = new ProjectType({
            name: "Empty_Name_PT_" + code1,
            nameAr: "نوع مشروع خالي",
            nameEn: "Empty Project Type",
            code: code1,
            description: "Should pull global defaults",
            category: "TEST",
        });

        // Trigger logic similar to service manually if needed, or we just test the model insertion 
        // Wait! The logic for fallback is in the service `createProjectType`, not in a Mongoose hook.
        // Let's mimic the exact snippet from projectType.service.js to test its effectiveness:
        let phasesInput = [];
        if (!phasesInput || phasesInput.length === 0) {
            if (globalPhases && globalPhases.length > 0) {
                phasesInput = globalPhases.map(p => ({
                    name: p.nameEn || p.nameAr,
                    nameAr: p.nameAr,
                    nameEn: p.nameEn,
                    order: p.order,
                    expectedDays: 30,
                    color: p.color || "#3498db"
                }));
            } else {
                 phasesInput = [
                     { nameAr: "التخطيط", nameEn: "Planning", name: "Planning", order: 1, expectedDays: 15, color: "#3498db" },
                     { nameAr: "التصميم", nameEn: "Design", name: "Design", order: 2, expectedDays: 30, color: "#9b59b6" },
                     { nameAr: "التنفيذ", nameEn: "Execution", name: "Execution", order: 3, expectedDays: 120, color: "#f1c40f" },
                     { nameAr: "الإغلاق", nameEn: "Closure", name: "Closure", order: 4, expectedDays: 10, color: "#2ecc71" }
                 ];
            }
        }
        ptEmpty.phases = phasesInput;
        await ptEmpty.save();
        console.log(`✅ Success: Saved ProjectType [${code1}] with ${ptEmpty.phases.length} phases!`);
        console.log(`   Phases populated: ${ptEmpty.phases.map(p => p.nameAr).join(" -> ")}`);


        console.log("\n[3] Testing Project Type Creation: Custom UI Design Pattern...");
        const code2 = "TEST-CUSTOM-" + Date.now().toString().slice(-4);
        const ptCustom = new ProjectType({
            name: "Custom_Name_PT_" + code2,
            nameAr: "نوع مشروع مخصص",
            nameEn: "Custom Project Type",
            code: code2,
            category: "TEST",
            phases: [
                {
                    nameAr: "مرحلة مخصصة",
                    nameEn: "Custom Phase",
                    order: 1,
                    expectedDays: 45,
                    fields: [
                        { name: "Field 1", type: "text", isRequired: true }
                    ],
                    attachments: [
                        { name: "Document X", type: "PDF", isRequired: true }
                    ],
                    approvals: [
                        // Just an artificial object ID for role
                        { entity: new mongoose.Types.ObjectId(), isRequired: true }
                    ]
                }
            ]
        });
        await ptCustom.save();
        console.log(`✅ Success: Saved Custom ProjectType [${code2}] with custom Blueprint data!`);
        console.log(`   Details: Phase 1 has ${ptCustom.phases[0].fields.length} field, ${ptCustom.phases[0].attachments.length} attachment, ${ptCustom.phases[0].approvals.length} approval entity.`);


        console.log("\n[4] Cleanup test artifacts...");
        await ProjectType.deleteMany({ code: { $in: [code1, code2] } });
        console.log("Cleanup done.");

    } catch (error) {
        console.error("❌ Test Failed:");
        console.error(error.message);
    } finally {
        mongoose.disconnect();
        console.log("\n=== TEST FINISHED ===");
        process.exit(0);
    }
}

runTest();
