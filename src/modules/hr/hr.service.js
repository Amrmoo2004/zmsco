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
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: requests });
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

    const formattedEmployees = employees.map(emp => {
        const activeAssig = empAssignments.find(a => a.user?.toString() === emp._id.toString());
        const utilizationRate = activeAssig ? (activeAssig.allocationPercentage || 100) : 0;
        return {
            id: emp._id,
            name: emp.name,
            jobTitle: emp.jobTitle?.nameAr || emp.jobTitle?.nameEn || emp.role?.name,
            status: activeAssig ? "مشغول" : "متاح",
            utilizationRate: utilizationRate > 100 ? 100 : utilizationRate,
            currentProject: activeAssig?.project?.name || "غير معين"
        };
    });

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

        return {
            id: eq._id,
            name: eq.name,
            type: eq.type,
            status: pStatus,
            utilizationRate: utilizationRate > 100 ? 100 : utilizationRate,
            currentProject: activeAssig?.project?.name || "غير معين"
        };
    });

    const totalResources = formattedEmployees.length + formattedEquipment.length;
    const busyCount = formattedEmployees.filter(e => e.status === "مشغول").length + formattedEquipment.filter(e => e.status === "مشغول").length;
    const availableCount = formattedEmployees.filter(e => e.status === "متاح").length + formattedEquipment.filter(e => e.status === "متاح").length;
    const unavailableCount = formattedEquipment.filter(e => e.status === "غير متاح").length;

    return res.status(200).json({
        success: true,
        data: {
            summary: {
                totalResources,
                totalEmployees: formattedEmployees.length,
                totalEquipment: formattedEquipment.length,
                available: availableCount,
                busy: busyCount,
                unavailable: unavailableCount
            },
            employees: formattedEmployees,
            equipments: formattedEquipment
        }
    });
});
