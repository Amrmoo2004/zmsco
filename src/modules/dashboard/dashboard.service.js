import ProjectModel from "../../db/models/projects/project.js";
import ProjectPhaseModel from "../../db/models/projects/project.phase.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import UserModel from "../../db/models/user.js";
import InventoryModel from "../../db/models/inventory.js";
import { getActiveConfig } from "../inventory-settings/inventorySettings.service.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * GET DASHBOARD STATS (Admin / global)
 *
 * Optimized: Replaced ~8 sequential queries with parallel execution + aggregation.
 */
export const getDashboardStats = asynchandler(async (req, res, next) => {

    // ── Run all independent queries in parallel ──────────────────────────────
    const [
        projectStats,
        budgetAgg,
        phases,
        users,
        inventoryConfig
    ] = await Promise.all([

        // 1. Project counts — single $facet aggregation instead of 5 countDocuments
        ProjectModel.aggregate([
            { $match: { isActive: true } },
            {
                $facet: {
                    total:     [{ $match: { status: { $ne: "ARCHIVED" } } }, { $count: "n" }],
                    completed: [{ $match: { status: "COMPLETED" } }, { $count: "n" }],
                    archived:  [{ $match: { status: "ARCHIVED" } }, { $count: "n" }],
                    active:    [{ $match: { status: { $in: ["PLANNING", "IN_PROGRESS"] } } }, { $count: "n" }],
                    onHold:    [{ $match: { status: "ON_HOLD" } }, { $count: "n" }],
                }
            }
        ]),

        // 2. Budget aggregation
        ProjectModel.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, totalBudget: { $sum: "$budget" }, totalEstimatedCost: { $sum: "$estimatedCost" } } }
        ]),

        // 3. All phases with tasks (lean for speed)
        ProjectPhaseModel.find({}, "tasks project").lean(),

        // 4. Users (lean for speed)
        UserModel.find({ isActive: true }, "name status performanceRating").lean(),

        // 5. Inventory config
        getActiveConfig()
    ]);

    // ── Extract project counts from $facet result ────────────────────────────
    const facet = projectStats[0] || {};
    const extract = (arr) => (arr && arr[0] && arr[0].n) || 0;

    const totalProjects     = extract(facet.total);
    const completedProjects = extract(facet.completed);
    const archivedProjects  = extract(facet.archived);
    const activeProjects    = extract(facet.active);
    const onHoldProjects    = extract(facet.onHold);

    // ── Budget ───────────────────────────────────────────────────────────────
    const totalBudget = budgetAgg.length > 0 ? budgetAgg[0].totalBudget : 0;
    const spentBudget = budgetAgg.length > 0 ? budgetAgg[0].totalEstimatedCost : 0;

    // ── Tasks Stats from ProjectPhases ────────────────────────────────────────
    let totalTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    let delayedTasks = 0;

    const tasksByProjectMap = {};
    const now = new Date();

    for (const phase of phases) {
        const projectId = phase.project.toString();
        if (!tasksByProjectMap[projectId]) {
            tasksByProjectMap[projectId] = { projectId, pending: 0, inProgress: 0, completed: 0, delayed: 0 };
        }

        const entry = tasksByProjectMap[projectId];

        for (const task of phase.tasks) {
            totalTasks++;
            if (task.status === "COMPLETED") {
                completedTasks++;
                entry.completed++;
            } else if (task.status === "IN_PROGRESS") {
                inProgressTasks++;
                entry.inProgress++;
            } else {
                pendingTasks++;
                entry.pending++;
            }

            if (task.dueDate && new Date(task.dueDate) < now && task.status !== "COMPLETED") {
                delayedTasks++;
                entry.delayed++;
            }
        }
    }

    // ── Employee Performance ─────────────────────────────────────────────────
    const employeePerformance = users
        .map(user => ({
            id: user._id,
            name: user.name,
            performanceRating: user.performanceRating || 0,
            completionRate: user.performanceRating ? (user.performanceRating / 5) * 100 : 0
        }))
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);

    // ── Attendance Stats ─────────────────────────────────────────────────────
    const totalEmployees = users.length;
    let presentCount = 0;
    let absentCount = 0;
    let onLeaveCount = 0;

    for (const user of users) {
        if (user.status === "ON_LEAVE") onLeaveCount++;
        else if (user.status === "AVAILABLE" || user.status === "BUSY") presentCount++;
        else absentCount++;
    }

    // ── Inventory Alerts (Low Stock) — only query if alerts are enabled ──────
    let lowStockCount = 0;
    if (inventoryConfig.lowStockAlerts) {
        const threshold = inventoryConfig.lowStockThreshold;
        const allInventory = await InventoryModel.find().populate("material", "alertQuantity").lean();

        for (const item of allInventory) {
            const itemThreshold = (item.material && item.material.alertQuantity)
                ? item.material.alertQuantity
                : threshold;
            if (item.quantity <= itemThreshold) lowStockCount++;
        }
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
 *
 * Optimized: Parallel queries + .lean()
 */
export const getMyDashboard = asynchandler(async (req, res) => {
    const userId = req.user._id;
    const now = new Date();

    // ── 1. Fetch member docs and task phases in parallel ─────────────────────
    const [memberDocs, taskPhases] = await Promise.all([
        ProjectMember.find({ user: userId }).select("project role").lean(),
        ProjectPhaseModel.find(
            { "tasks.assignedTo": userId },
            "project name nameAr tasks"
        ).lean()
    ]);

    const memberProjectIds = memberDocs.map(m => m.project);

    // ── 2. Fetch user's projects + all phases for those projects in parallel ─
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

    // Fetch all phases for user's projects (for project cards) + task project names in parallel
    const taskProjectIds = [...new Set(taskPhases.map(ph => ph.project.toString()))];

    const [allPhases, taskProjects] = await Promise.all([
        ProjectPhaseModel.find(
            { project: { $in: myProjectIds } },
            "project name nameAr status order tasks"
        ).lean(),
        taskProjectIds.length > 0
            ? ProjectModel.find({ _id: { $in: taskProjectIds } }, "name code").lean()
            : []
    ]);

    // ── 3. Task statistics ──────────────────────────────────────────────────
    let delayedCount = 0;
    let pendingApprovalCount = 0;
    let inProgressCount = 0;
    const myTasks = [];

    // Build a lookup map for task project names (avoids O(n²) .find())
    const taskProjectMap = new Map();
    for (const p of taskProjects) {
        taskProjectMap.set(p._id.toString(), p);
    }

    for (const phase of taskPhases) {
        for (const task of (phase.tasks || [])) {
            if (!task.assignedTo || task.assignedTo.toString() !== userId.toString()) continue;

            const isDelayed = !!(task.dueDate && new Date(task.dueDate) < now && task.status !== "COMPLETED");

            if (isDelayed) delayedCount++;
            if (task.status === "IN_PROGRESS") inProgressCount++;
            if (task.status === "PENDING") pendingApprovalCount++;

            const relatedProject = taskProjectMap.get(phase.project.toString());

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
        }
    }

    // ── 4. Format projects ──────────────────────────────────────────────────
    const projectsFormatted = myProjects.map(project => {
        const phases = allPhases
            .filter(ph => ph.project.toString() === project._id.toString())
            .sort((a, b) => a.order - b.order);

        let totalTasks = 0, completedTasksCount = 0, activeTasks = 0;
        for (const ph of phases) {
            for (const t of (ph.tasks || [])) {
                totalTasks++;
                if (t.status === "COMPLETED") completedTasksCount++;
                if (t.status === "IN_PROGRESS") activeTasks++;
            }
        }

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

    // ── 5. Sort tasks: delayed first ────────────────────────────────────────
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
