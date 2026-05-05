import ProjectModel from "../../db/models/projects/project.js";
import ProjectPhaseModel from "../../db/models/projects/project.phase.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import UserModel from "../../db/models/user.js";
import InventoryModel from "../../db/models/inventory.js";
import { getActiveConfig } from "../inventory-settings/inventorySettings.service.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * GET DASHBOARD STATS (Admin / global)
 */
export const getDashboardStats = asynchandler(async (req, res, next) => {
    // 1. Projects Stats (ARCHIVED projects are treated separately — read-only)
    const totalProjects = await ProjectModel.countDocuments({
        isActive: true,
        status: { $ne: "ARCHIVED" }
    });
    const completedProjects = await ProjectModel.countDocuments({ isActive: true, status: "COMPLETED" });
    const archivedProjects = await ProjectModel.countDocuments({ isActive: true, status: "ARCHIVED" });
    const activeProjects = await ProjectModel.countDocuments({
        isActive: true,
        status: { $in: ["PLANNING", "IN_PROGRESS"] }
    });
    const onHoldProjects = await ProjectModel.countDocuments({ isActive: true, status: "ON_HOLD" });

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
    }).sort((a, b) => b.completionRate - a.completionRate).slice(0, 5);

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
            const itemThreshold = (item.material && item.material.alertQuantity)
                ? item.material.alertQuantity
                : threshold;
            if (item.quantity <= itemThreshold) lowStockCount++;
        });
    }

    const tasksByProject = Object.values(tasksByProjectMap).slice(0, 10);

    return res.status(200).json({
        success: true,
        data: {
            projects: {
                total: totalProjects,
                active: activeProjects,
                completed: completedProjects,
                onHold: onHoldProjects,
                archived: archivedProjects,
                projectPerformance: []
            },
            tasks: {
                total: totalTasks,
                pending: pendingTasks,
                inProgress: inProgressTasks,
                completed: completedTasks,
                delayed: delayedTasks,
                tasksByProject
            },
            financials: {
                totalBudget,
                spentBudget,
                currency: "SAR"
            },
            employees: {
                total: totalEmployees,
                present: presentCount,
                absent: absentCount,
                onLeave: onLeaveCount,
                performance: employeePerformance
            },
            inventory: {
                lowStockCount,
                status: lowStockCount > 0 ? "WARNING" : "GOOD"
            }
        }
    });
});

/**
 * GET MY DASHBOARD  (Personal — للمستخدم الحالي)
 * ─────────────────────────────────────────────
 * يُرجع:
 *   stats.delayed          عدد المهام المتأخرة          ← البطاقة الحمراء
 *   stats.pendingApproval  مهام بانتظار الموافقة (PENDING) ← البطاقة الصفراء
 *   stats.inProgress       مهام قيد التنفيذ              ← البطاقة الزرقاء
 *   stats.myProjectsCount  عدد مشاريعه                  ← البطاقة الخضراء
 *   tasks[]                قائمة مهامه (متأخرة أولاً)
 *   projects[]             مشاريعه مع نسبة الإنجاز والمرحلة الحالية
 */
export const getMyDashboard = asynchandler(async (req, res) => {
    const userId = req.user._id;
    const now = new Date();

    // ── 1. مشاريع المستخدم (عضو أو مدير) ─────────────────────────────────────
    const memberDocs = await ProjectMember.find({ user: userId }).select("project role").lean();
    const memberProjectIds = memberDocs.map(m => m.project);

    const myProjects = await ProjectModel.find({
        isActive: true,
        status: { $ne: "ARCHIVED" },
        $or: [
            { _id: { $in: memberProjectIds } },
            { manager: userId }
        ]
    })
        .populate("type", "name nameAr")
        .populate("manager", "name")
        .lean();

    const myProjectIds = myProjects.map(p => p._id);

    // ── 2. كل مراحل المشاريع الخاصة بالمستخدم (للـ projects section) ──────────
    const allPhases = await ProjectPhaseModel.find(
        { project: { $in: myProjectIds } },
        "project name nameAr status order tasks"
    ).lean();

    // ── 2b. البحث عن التاسكات عبر كل الـ phases (مش مقيّد بالمشاريع)
    //       يضمن ظهور التاسك حتى لو المستخدم ADMIN وليس member رسمي
    const taskPhases = await ProjectPhaseModel.find(
        { "tasks.assignedTo": userId },
        "project name nameAr tasks"
    ).lean();

    // ── 3. إحصائيات المهام — من taskPhases (كل الـ phases التي فيها تاسك له) ──
    let delayedCount = 0;
    let pendingApprovalCount = 0;
    let inProgressCount = 0;
    const myTasks = [];

    // جلب أسماء المشاريع لكل تاسك
    const taskProjectIds = [...new Set(taskPhases.map(ph => ph.project.toString()))];
    const taskProjects = taskProjectIds.length > 0
        ? await ProjectModel.find({ _id: { $in: taskProjectIds } }, "name code").lean()
        : [];

    taskPhases.forEach(phase => {
        (phase.tasks || []).forEach(task => {
            if (!task.assignedTo || task.assignedTo.toString() !== userId.toString()) return;

            const isDelayed = !!(task.dueDate && new Date(task.dueDate) < now && task.status !== "COMPLETED");

            if (isDelayed) delayedCount++;
            if (task.status === "IN_PROGRESS") inProgressCount++;
            if (task.status === "PENDING") pendingApprovalCount++;

            const relatedProject = taskProjects.find(
                p => p._id.toString() === phase.project.toString()
            );

            myTasks.push({
                _id: task._id,
                name: task.name,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                isDelayed,
                projectId: phase.project,
                projectName: relatedProject?.name || "",
                phaseId: phase._id,
                phaseName: phase.nameAr || phase.name
            });
        });
    });

    // ── 4. تجميع بيانات المشاريع (نسبة إنجاز + المرحلة الحالية + عدد المهام)
    const projectsFormatted = myProjects.map(project => {
        const phases = allPhases
            .filter(ph => ph.project.toString() === project._id.toString())
            .sort((a, b) => a.order - b.order);

        let totalTasks = 0, completedTasksCount = 0, activeTasks = 0;
        phases.forEach(ph => {
            (ph.tasks || []).forEach(t => {
                totalTasks++;
                if (t.status === "COMPLETED") completedTasksCount++;
                if (t.status === "IN_PROGRESS") activeTasks++;
            });
        });

        const progress = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

        // المرحلة الحالية النشطة
        const currentPhase =
            phases.find(ph => ph.status === "IN_PROGRESS") ||
            phases.find(ph => ph.status === "PENDING") ||
            phases[phases.length - 1];

        // دور المستخدم في هذا المشروع
        const memberDoc = memberDocs.find(
            m => m.project.toString() === project._id.toString()
        );
        const managerId = project.manager?._id?.toString() || project.manager?.toString();
        const myRole = managerId === userId.toString()
            ? "مدير المشروع"
            : (memberDoc?.role || "عضو فريق");

        return {
            _id: project._id,
            name: project.name,
            code: project.code,
            status: project.status,
            priority: project.priority,
            startDate: project.startDate,
            endDate: project.endDate,
            location: project.location,
            type: project.type,
            manager: project.manager,
            progress,
            totalTasks,
            activeTasks,
            completedTasks: completedTasksCount,
            myRole,
            currentPhase: currentPhase ? {
                _id: currentPhase._id,
                name: currentPhase.nameAr || currentPhase.name,
                status: currentPhase.status,
                order: currentPhase.order
            } : null,
            phases: phases.map(ph => ({
                _id: ph._id,
                name: ph.nameAr || ph.name,
                status: ph.status,
                order: ph.order
            }))
        };
    });

    // ── 5. ترتيب المهام: متأخرة أولاً ─────────────────────────────────────────
    const sortedTasks = myTasks.sort((a, b) => {
        if (a.isDelayed && !b.isDelayed) return -1;
        if (!a.isDelayed && b.isDelayed) return 1;
        return 0;
    });

    return res.status(200).json({
        success: true,
        data: {
            stats: {
                delayed: delayedCount,
                pendingApproval: pendingApprovalCount,
                inProgress: inProgressCount,
                myProjectsCount: myProjects.length
            },
            tasks: sortedTasks,
            projects: projectsFormatted
        }
    });
});
