import { Equipment, EquipmentMaintenance, EquipmentAssignment } from "../../db/models/hr/equipment.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// ─── Equipment CRUD ───────────────────────────────────────────────────────────

export const getAllEquipment = asynchandler(async (req, res) => {
    const equipment = await Equipment.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: equipment });
});

export const getEquipmentById = asynchandler(async (req, res, next) => {
    const eq = await Equipment.findById(req.params.id);
    if (!eq) return next(new AppError("Equipment not found", 404));
    return res.status(200).json({ success: true, data: eq });
});

export const createEquipment = asynchandler(async (req, res) => {
    const eq = await Equipment.create(req.body);
    return res.status(201).json({ success: true, message: "Equipment created", data: eq });
});

export const updateEquipment = asynchandler(async (req, res, next) => {
    const eq = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!eq) return next(new AppError("Equipment not found", 404));
    return res.status(200).json({ success: true, message: "Equipment updated", data: eq });
});

export const deleteEquipment = asynchandler(async (req, res, next) => {
    const eq = await Equipment.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!eq) return next(new AppError("Equipment not found", 404));
    return res.status(200).json({ success: true, message: "Equipment deactivated" });
});

// ─── Maintenance Log ─────────────────────────────────────────────────────────

export const getMaintenanceLogs = asynchandler(async (req, res) => {
    const logs = await EquipmentMaintenance.find({ equipment: req.params.id })
        .sort({ date: -1 });
    return res.status(200).json({ success: true, data: logs });
});

export const addMaintenanceLog = asynchandler(async (req, res) => {
    const log = await EquipmentMaintenance.create({ ...req.body, equipment: req.params.id });
    // Update equipment condition
    if (req.body.condition) {
        await Equipment.findByIdAndUpdate(req.params.id, { condition: req.body.condition });
    }
    return res.status(201).json({ success: true, message: "Maintenance log added", data: log });
});

// ─── Assignments ─────────────────────────────────────────────────────────────

export const getAssignments = asynchandler(async (req, res) => {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.equipment) filter.equipment = req.query.equipment;
    const assignments = await EquipmentAssignment.find(filter)
        .populate("equipment", "name type")
        .populate("project", "name")
        .populate("phase", "name")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: assignments });
});

export const assignEquipment = asynchandler(async (req, res) => {
    const { equipment, project, phase, startDate, endDate, allocationPercentage, notes } = req.body;
    // Snapshot current daily cost
    const eq = await Equipment.findById(equipment);
    const assignment = await EquipmentAssignment.create({
        equipment, project, phase, startDate, endDate,
        allocationPercentage, notes,
        dailyCostSnapshot: eq?.dailyCost
    });
    return res.status(201).json({ success: true, message: "Equipment assigned", data: assignment });
});

export const updateAssignment = asynchandler(async (req, res, next) => {
    const assignment = await EquipmentAssignment.findByIdAndUpdate(req.params.assignmentId, req.body, { new: true });
    if (!assignment) return next(new AppError("Assignment not found", 404));
    return res.status(200).json({ success: true, message: "Assignment updated", data: assignment });
});
