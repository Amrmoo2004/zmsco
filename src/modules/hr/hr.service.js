import WorkLog from "../../db/models/hr/workLog.model.js";
import HrRequest from "../../db/models/hr/hrRequest.model.js";
import User from "../../db/models/user.js";
import Project from "../../db/models/projects/project.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";

// ─── HR_TYPE_LABELS shared constant ──────────────────────────────────────────────────
const HR_TYPE_LABELS = { LEAVE: "إجازة", REPLACEMENT: "بديل", OVERTIME: "عمل إضافي", ADVANCE: "سلفة" };

// ─── Work Logs (Timesheets) ───────────────────────────────────────────────────

export const getWorkLogs = asynchandler(async (req, res) => {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.user) filter.user = req.query.user;
    if (req.query.phase) filter.phase = req.query.phase;
    const logs = await WorkLog.find(filter)
        .populate("user", "name email hourlyRate")
        .populate("project", "name")
        .populate("phase", "name")
        .sort({ date: -1 });
    return res.status(200).json({ success: true, data: logs });
});

export const createWorkLog = asynchandler(async (req, res, next) => {
    const { project, phase, date, hoursLogged, description } = req.body;
    const user = req.user._id;
    const userDoc = await User.findById(user);
    const cost = (userDoc?.hourlyRate || 0) * hoursLogged;
    const log = await WorkLog.create({ user, project, phase, date, hoursLogged, description, cost });
    return res.status(201).json({ success: true, message: "Work log created", data: log });
});

export const updateWorkLog = asynchandler(async (req, res, next) => {
    const log = await WorkLog.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        req.body,
        { new: true }
    );
    if (!log) return next(new AppError("Work log not found or unauthorized", 404));
    return res.status(200).json({ success: true, message: "Work log updated", data: log });
});

export const deleteWorkLog = asynchandler(async (req, res, next) => {
    const log = await WorkLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!log) return next(new AppError("Work log not found or unauthorized", 404));
    return res.status(200).json({ success: true, message: "Work log deleted" });
});

// ─── HR Requests ───────────────────────────────────────────────────────────────

export const getHrRequests = asynchandler(async (req, res) => {
    const isAdmin = ["ADMIN", "superAdmin"].includes(req.user.role);
    let filter = {};

    if (isAdmin) {
        // ── Admin: يشوف كل الطلبات ──────────────────────────────────────
        filter = {};
    } else {
        // ── مش Admin: لازم نحدد مين يشوف إيه ────────────────────────────
        // 1. الطلبات اللي قدمها هو بنفسه
        const ownFilter = { user: req.user._id };

        // 2. لو هو مدير مشروع → يشوف الطلبات المرتبطة بمشاريعه
        const Project = (await import("../../db/models/projects/project.js")).default;
        const managedProjects = await Project.find({ manager: req.user._id, isActive: true })
            .select("_id").lean();
        const managedProjectIds = managedProjects.map(p => p._id);

        if (managedProjectIds.length > 0) {
            // يشوف طلباته هو + طلبات مشاريعه
            filter = {
                $or: [
                    { user: req.user._id },
                    { relatedProject: { $in: managedProjectIds } }
                ]
            };
        } else {
            // موظف عادي: طلباته بس
            filter = ownFilter;
        }
    }

    const requests = await HrRequest.find(filter)
        .populate("user", "name email")
        .populate("relatedProject", "name")
        .populate("processedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

    const formattedRequests = requests.map(r => {
        const start    = new Date(r.startDate);
        const end      = new Date(r.endDate);
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
        return {
            ...r,
            userName:    r.user ? r.user.name : "غير معروف",
            projectName: r.relatedProject?.name || null,
            duration:    `${duration} أيام`
        };
    });

    const stats = {
        total:    requests.length,
        pending:  requests.filter(r => r.status === "PENDING").length,
        approved: requests.filter(r => r.status === "APPROVED").length,
        rejected: requests.filter(r => r.status === "REJECTED").length,
    };

    return res.status(200).json({ success: true, data: formattedRequests, stats });
});

export const createHrRequest = asynchandler(async (req, res) => {
    const request = await HrRequest.create({ ...req.body, user: req.user._id, status: "PENDING" });

    const typeLabel = HR_TYPE_LABELS[request.requestType] || request.requestType;
    const dateStr   = request.startDate ? new Date(request.startDate).toLocaleDateString("ar") : "";
    const notifBody = `أرسل ${req.user.name || "موظف"} طلب ${typeLabel} بتاريخ ${dateStr} — يرجى المراجعة.`;
    const notifData = { requestId: request._id, requestType: request.requestType };

    // ── إشعار جميع الادمنز ───────────────────────────────────────────────
    const admins = await User.find({
        $or: [{ role: "ADMIN" }, { role: "superAdmin" }],
        isActive: true
    }).select("_id").lean();

    await Promise.all(
        admins.map(admin =>
            createNotification(admin._id, `📋 طلب ${typeLabel} جديد`, notifBody, "INFO", notifData).catch(() => {})
        )
    );

    // ── إشعار مدير المشروع إن كان الطلب مرتبطاً بمشروع ──────────────────────────
    if (request.relatedProject) {
        const projectDoc = await Project
            .findById(request.relatedProject).select("manager name").lean();

        if (projectDoc?.manager) {
            const managerId = String(projectDoc.manager);
            // Don't double-notify if manager is also an admin
            const alreadyNotified = admins.some(a => String(a._id) === managerId);
            if (!alreadyNotified) {
                await createNotification(
                    projectDoc.manager,
                    `📋 طلب ${typeLabel} جديد — مشروع "${projectDoc.name}"`,
                    notifBody,
                    "INFO",
                    notifData
                ).catch(() => {});
            }
        }
    }

    return res.status(201).json({ success: true, message: "HR request submitted", data: request });
});

export const processHrRequest = asynchandler(async (req, res, next) => {
    const { status, rejectionReason } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status))
        return next(new AppError("status يجب أن يكون APPROVED أو REJECTED", 400));

    // ── Authorization: ADMIN/superAdmin أو مدير المشروع المرتبط ──────────
    const isAdmin = ["ADMIN", "superAdmin"].includes(req.user.role);
    let isProjectManager = false;

    const request = await HrRequest.findById(req.params.id)
        .populate("user", "name email _id")
        .populate("relatedProject", "manager name");
    if (!request) return next(new AppError("HR request not found", 404));

    if (!isAdmin && request.relatedProject?.manager) {
        isProjectManager = String(request.relatedProject.manager) === String(req.user._id);
    }

    if (!isAdmin && !isProjectManager)
        return next(new AppError("غير مصرح لك — فقط الادمن أو مدير المشروع يمكنهما معالجة هذا الطلب", 403));
    if (request.status !== "PENDING")
        return next(new AppError("الطلب تمت معالجته بالفعل", 400));

    request.status      = status;
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    if (status === "REJECTED") request.rejectionReason = rejectionReason;
    await request.save();

    // ── إشعار مقدم الطلب بالنتيجة ────────────────────────────────────
    const typeLabel = HR_TYPE_LABELS[request.requestType] || request.requestType;

    if (request.user?._id) {
        const isApproved = status === "APPROVED";
        await createNotification(
            request.user._id,
            isApproved ? `✅ تمت الموافقة على طلب ${typeLabel}` : `❌ تم رفض طلب ${typeLabel}`,
            isApproved
                ? `تمت الموافقة على طلب ${typeLabel} الخاص بك بتاريخ ${request.startDate ? new Date(request.startDate).toLocaleDateString("ar") : ""}.`
                : `تم رفض طلب ${typeLabel} الخاص بك.${rejectionReason ? " السبب: " + rejectionReason : ""}`,
            isApproved ? "SUCCESS" : "ERROR",
            { requestId: request._id, requestType: request.requestType }
        );
    }

    return res.status(200).json({ success: true, message: `HR Request ${status}`, data: request });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────────

import { Equipment, EquipmentAssignment } from "../../db/models/hr/equipment.model.js";
import ProjectMember from "../../db/models/projects/project.member.js";

// Note: Project is imported at the top of the file

export const getDashboard = asynchandler(async (req, res) => {
    // 1. Get Employees except admins maybe, let's just get active employees
    const employees = await User.find({ isActive: true })
        .populate("role", "name")
        .populate("jobTitle", "nameAr nameEn")
        .lean();
    // Get all active assignments for employees
    const empAssignments = await ProjectMember.find({ status: "ACTIVE" })
        .populate("project", "name")
        .lean();

    let totalMonthlyCost = 0;
    let totalRevenue = 0;
    let totalUtilizationRateSum = 0;

    const formattedEmployees = employees.map(emp => {
        const activeAssig = empAssignments.find(a => a.user?.toString() === emp._id.toString());
        const utilizationRate = activeAssig ? (activeAssig.allocationPercentage || 100) : 0;
        
        const cost = (emp.hourlyRate || 50) * 8 * 22 * (utilizationRate / 100);
        const revenue = cost * 1.3;

        totalMonthlyCost += cost;
        totalRevenue += revenue;
        totalUtilizationRateSum += utilizationRate;

        return {
            id: emp._id,
            name: emp.name,
            jobTitle: emp.jobTitle?.nameAr || emp.jobTitle?.nameEn || emp.role?.name,
            status: emp.status === "ON_LEAVE" ? "إجازة" : (activeAssig ? "مشغول" : "متاح"),
            utilizationRate: utilizationRate > 100 ? 100 : utilizationRate,
            currentProject: activeAssig?.project?.name || "غير معين",
            cost,
            revenue
        };
    });

    const employeesStats = {
        total: employees.length,
        onLeave: formattedEmployees.filter(e => e.status === "إجازة").length,
        available: formattedEmployees.filter(e => e.status === "متاح").length,
        busy: formattedEmployees.filter(e => e.status === "مشغول").length
    };

    // 2. Get Equipments
    const equipments = await Equipment.find({ isActive: true }).lean();
    const eqAssignments = await EquipmentAssignment.find({ status: "ACTIVE" })
        .populate("project", "name")
        .lean();

    const formattedEquipment = equipments.map(eq => {
        const activeAssig = eqAssignments.find(a => a.equipment?.toString() === eq._id.toString());
        const utilizationRate = activeAssig ? (activeAssig.allocationPercentage || 100) : 0;
        let pStatus = "متاح";
        if (eq.condition === "UNDER_MAINTENANCE") pStatus = "غير متاح";
        else if (activeAssig) pStatus = "مشغول";

        const dailyCost = eq.dailyCost || 1000;
        const maintenanceCost = (pStatus === "غير متاح") ? dailyCost * 0.5 * 30 : 0;
        const cost = (dailyCost * 30 * (utilizationRate / 100)) + maintenanceCost;
        const revenue = cost * 1.5;

        totalMonthlyCost += cost;
        if(pStatus === "مشغول") totalRevenue += revenue;
        totalUtilizationRateSum += utilizationRate;

        return {
            id: eq._id,
            name: eq.name,
            type: eq.type,
            status: pStatus,
            utilizationRate: utilizationRate > 100 ? 100 : utilizationRate,
            currentProject: activeAssig?.project?.name || "غير معين",
            cost: maintenanceCost, // Cost often mapped to maintenance for equipment in UI
            revenue,
            dailyCost
        };
    });

    const totalResources = formattedEmployees.length + formattedEquipment.length;
    const averageUtilization = totalResources ? Math.round(totalUtilizationRateSum / totalResources) : 0;

    // 3. Project Costs
    const projects = await Project.find({ status: { $in: ["EXECUTION", "PLANNING"] } }).lean();
    const projectCosts = projects.map(proj => {
        const pEemps = empAssignments.filter(a => a.project?._id?.toString() === proj._id.toString()).length;
        const pEqs = eqAssignments.filter(a => a.project?._id?.toString() === proj._id.toString()).length;
        // Mock actual costs just for UI parity
        const actualCost = proj.budget * 0.75; 
        
        return {
            project: proj.name,
            status: proj.status,
            employeesCount: pEemps,
            equipmentCount: pEqs,
            budget: proj.budget || 500000,
            actualCost: actualCost
        };
    });

    return res.status(200).json({
        success: true,
        data: {
            stats: {
                totalEmployees: employeesStats.total,
                onLeave: employeesStats.onLeave,
                jobRequests: 0 // Mocked for UI
            },
            performanceStats: {
                totalResources,
                averageUtilization,
                totalMonthlyCost: Math.round(totalMonthlyCost),
                totalRevenue: Math.round(totalRevenue)
            },
            projectCosts,
            employees: formattedEmployees,
            equipments: formattedEquipment,
            learningCurve: [
                { month: "يناير", performance: 75, utilization: 62 },
                { month: "فبراير", performance: 82, utilization: 68 },
                { month: "مارس", performance: 87, utilization: 72 }
            ]
        }
    });
});

import ProjectPhase from "../../db/models/projects/project.phase.js";

// ─── Employee Profile ────────────────────────────────────────────────────────
export const getEmployeeProfile = asynchandler(async (req, res, next) => {
    const { userId } = req.params;

    const employee = await User.findById(userId).populate("jobTitle", "nameAr nameEn").lean();
    if (!employee) return next(new AppError("Employee not found", 404));

    // Get Active Assignments
    const assignments = await ProjectMember.find({ user: userId })
        .populate("project", "name code")
        .populate("phase", "name")
        .lean();

    const currentAssignment = assignments.find(a => a.status === "ACTIVE");
    const utilizationRate = currentAssignment ? (currentAssignment.allocationPercentage || 100) : 0;

    // Overview data
    const overview = {
        name: employee.name,
        email: employee.email,
        jobTitle: employee.jobTitle?.nameAr || employee.jobTitle?.nameEn || employee.role?.name,
        status: employee.status === "ON_LEAVE" ? "إجازة" : (currentAssignment ? "مشغول" : "متاح"),
        utilizationRate
    };

    // Projects list
    const projects = assignments.map(a => ({
        id: a.project?._id,
        name: a.project?.name,
        code: a.project?.code,
        role: a.role,
        status: a.status,
        startDate: a.startDate,
        endDate: a.endDate,
        allocationPercentage: a.allocationPercentage
    }));

    // Work History (سجل العمل) - From Tasks assigned to this user across all phases
    const phases = await ProjectPhase.find({ "tasks.assignedTo": userId })
        .populate("project", "name")
        .lean();

    let workHistory = [];
    phases.forEach(phase => {
        const userTasks = phase.tasks.filter(t => t.assignedTo?.toString() === userId.toString());
        userTasks.forEach(task => {
            let percentage = 0;
            if (task.status === "COMPLETED") percentage = 100;
            else if (task.status === "IN_PROGRESS") percentage = 50;

            workHistory.push({
                id: task._id,
                date: task.completedAt || task.updatedAt || task.createdAt,
                project: phase.project?.name || "مشروع غير معروف",
                activity: task.name,
                completionPercentage: percentage,
                status: task.status
            });
        });
    });

    // Sort work history by date descending
    workHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
        success: true,
        data: {
            overview,
            projects,
            workHistory
        }
    });
});
