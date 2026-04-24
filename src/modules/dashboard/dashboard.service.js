import ProjectModel from "../../db/models/projects/project.js";
import ProjectPhaseModel from "../../db/models/projects/project.phase.js";
import UserModel from "../../db/models/user.js";
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
        { $group: { _id: null, totalBudget: { $sum: "$budget" }, totalEstimatedCost: { $sum: "$estimatedCost" } } }
    ]);
    const totalBudget = budgetAgg.length > 0 ? budgetAgg[0].totalBudget : 0;
    const spentBudget = budgetAgg.length > 0 ? budgetAgg[0].totalEstimatedCost : 0;

    // 3. Tasks Stats from ProjectPhases
    const phases = await ProjectPhaseModel.find({}, "tasks project");
    let totalTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    let delayedTasks = 0;
    
    // For tasks by project chart
    const tasksByProjectMap = {};

    phases.forEach(phase => {
        const projectId = phase.project.toString();
        if (!tasksByProjectMap[projectId]) {
            tasksByProjectMap[projectId] = { projectId, pending: 0, inProgress: 0, completed: 0, delayed: 0 };
        }

        phase.tasks.forEach(task => {
            totalTasks++;
            if (task.status === "COMPLETED") {
                completedTasks++;
                tasksByProjectMap[projectId].completed++;
            } else if (task.status === "IN_PROGRESS") {
                inProgressTasks++;
                tasksByProjectMap[projectId].inProgress++;
            } else {
                pendingTasks++;
                tasksByProjectMap[projectId].pending++;
            }
            
            // Assume delayed if dueDate is past and not completed
            if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED") {
                delayedTasks++;
                tasksByProjectMap[projectId].delayed++;
            }
        });
    });

    // 4. Employee Performance
    const users = await UserModel.find({ isActive: true }, "name status performanceRating hrProfile");
    const employeePerformance = users.map(user => {
        return {
            id: user._id,
            name: user.name,
            performanceRating: user.performanceRating || 0,
            completionRate: user.performanceRating ? (user.performanceRating / 5) * 100 : 0
        };
    }).sort((a, b) => b.completionRate - a.completionRate).slice(0, 5); // top 5 employees

    // 5. Attendance Stats
    const totalEmployees = users.length;
    let presentCount = 0;
    let absentCount = 0;
    let onLeaveCount = 0;
    
    users.forEach(user => {
        if (user.status === "ON_LEAVE") onLeaveCount++;
        else if (user.status === "AVAILABLE" || user.status === "BUSY") presentCount++;
        else absentCount++;
    });

    // 6. Inventory Alerts (Low Stock)
    const inventoryConfig = await getActiveConfig();
    let lowStockCount = 0;
    if (inventoryConfig.lowStockAlerts) {
        const threshold = inventoryConfig.lowStockThreshold;
        const allInventory = await InventoryModel.find().populate("material", "alertQuantity");
        
        allInventory.forEach(item => {
            const itemThreshold = (item.material && item.material.alertQuantity) ? item.material.alertQuantity : threshold;
            if (item.quantity <= itemThreshold) lowStockCount++;
        });
    }

    // 7. Tasks By Project Data Array
    const tasksByProject = Object.values(tasksByProjectMap).slice(0, 10); // top 10 projects

    return res.status(200).json({
        success: true,
        data: {
            projects: {
                total: totalProjects,
                active: activeProjects,
                completed: completedProjects,
                projectPerformance: [] // Can be populated with historical data if tracked
            },
            tasks: {
                total: totalTasks,
                pending: pendingTasks,
                inProgress: inProgressTasks,
                completed: completedTasks,
                delayed: delayedTasks,
                tasksByProject: tasksByProject
            },
            financials: {
                totalBudget: totalBudget,
                spentBudget: spentBudget,
                currency: "SAR" // SAR is commonly used in Riyadh projects (per screenshots)
            },
            employees: {
                total: totalEmployees,
                present: presentCount,
                absent: absentCount,
                onLeave: onLeaveCount,
                performance: employeePerformance
            },
            inventory: {
                lowStockCount: lowStockCount,
                status: lowStockCount > 0 ? "WARNING" : "GOOD"
            }
        }
    });
});
