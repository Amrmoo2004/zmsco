import ProjectPhaseTemplate from "../db/models/settings/projectPhaseTemplate.model.js";

export const seedDefaultSettings = async () => {
    try {
        const count = await ProjectPhaseTemplate.countDocuments();
        if (count === 0) {
            const defaultPhases = [
                { nameAr: "التخطيط", nameEn: "Planning", order: 1, color: "#3498db" },
                { nameAr: "التصميم", nameEn: "Design", order: 2, color: "#9b59b6" },
                { nameAr: "التنفيذ", nameEn: "Execution", order: 3, color: "#f1c40f" },
                { nameAr: "الإغلاق", nameEn: "Closure", order: 4, color: "#2ecc71" }
            ];
            await ProjectPhaseTemplate.insertMany(defaultPhases);
            console.log("✅ Seeded default global Project Phases into Settings.");
        }
    } catch (error) {
        console.error("❌ Failed to seed default settings:", error);
    }
};
