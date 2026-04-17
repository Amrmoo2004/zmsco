import ProjectModel from "../../db/models/projects/project.js";
import InventoryModel from "../../db/models/inventory.js";
import { getActiveConfig } from "../inventory-settings/inventorySettings.service.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * GET DASHBOARD STATS
 */
export const getDashboardStats = asynchandler(async (req, res, next) => {
    // 1. Projects Stats
    const totalProjects = await ProjectModel.countDocuments({ isActive: true });
    const completedProjects = await ProjectModel.countDocuments({ isActive: true, status: "COMPLETED" });
    const activeProjects = await ProjectModel.countDocuments({
        isActive: true,
        status: { $in: ["PLANNING", "EXECUTION"] }
    });

    // 2. Budget Stats
    const budgetAgg = await ProjectModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalBudget: { $sum: "$budget" } } }
    ]);
    const totalBudget = budgetAgg.length > 0 ? budgetAgg[0].totalBudget : 0;

    // 3. Inventory Alerts (Low Stock) — يستخدم إعدادات المخزون الفعلية
    const inventoryConfig = await getActiveConfig();

    let lowStockCount = 0;
    if (inventoryConfig.lowStockAlerts) {
        const threshold = inventoryConfig.lowStockThreshold;
        const allInventory = await InventoryModel.find().populate("material", "alertQuantity");
        
        allInventory.forEach(item => {
            // الأولوية: alertQuantity على المادة نفسها، وإلا: الإعداد العام
            const itemThreshold = (item.material && item.material.alertQuantity)
                ? item.material.alertQuantity
                : threshold;

            if (item.quantity <= itemThreshold) {
                lowStockCount++;
            }
        });
    }

    return res.status(200).json({
        success: true,
        data: {
            projects: {
                total: totalProjects,
                active: activeProjects,
                completed: completedProjects
            },
            financials: {
                totalBudget: totalBudget,
                currency: "EGP"
            },
            inventory: {
                lowStockCount: lowStockCount,
                status: lowStockCount > 0 ? "WARNING" : "GOOD"
            }
        }
    });
});
