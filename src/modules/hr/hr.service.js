import WorkLog from "../../db/models/hr/workLog.model.js";
import HrRequest from "../../db/models/hr/hrRequest.model.js";
import User from "../../db/models/user.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

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
    const filter = req.query.all === "true" ? {} : { user: req.user._id };
    const requests = await HrRequest.find(filter)
        .populate("user", "name email")
        .populate("processedBy", "name email")
        .sort({ createdAt: -1 })
        .lean();

    const formattedRequests = requests.map(req => {
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1;
        return {
            ...req,
            userName: req.user ? req.user.name : "غير معروف",
            duration: `${duration} أيام`
        };
    });

    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === "PENDING").length,
        approved: requests.filter(r => r.status === "APPROVED").length,
        rejected: requests.filter(r => r.status === "REJECTED").length,
    };

    return res.status(200).json({ success: true, data: formattedRequests, stats });
});

export const createHrRequest = asynchandler(async (req, res) => {
    const request = await HrRequest.create({ ...req.body, user: req.user._id, status: "PENDING" });
    return res.status(201).json({ success: true, message: "HR request submitted", data: request });
});

export const processHrRequest = asynchandler(async (req, res, next) => {
    const { status, rejectionReason } = req.body;
    const request = await HrRequest.findById(req.params.id);
    if (!request) return next(new AppError("HR request not found", 404));
    request.status = status;
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    if (status === "REJECTED") request.rejectionReason = rejectionReason;
    await request.save();
    return res.status(200).json({ success: true, message: `HR Request ${status}`, data: request });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

import { Equipment, EquipmentAssignment } from "../../db/models/hr/equipment.model.js";
import ProjectMember from "../../db/models/projects/project.member.js";

import Project from "../../db/models/projects/project.js";

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
