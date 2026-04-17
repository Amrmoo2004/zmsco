import { Equipment, EquipmentMaintenance, EquipmentAssignment } from "../../db/models/hr/equipment.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// ─── Equipment CRUD ───────────────────────────────────────────────────────────

export const getAllEquipment = asynchandler(async (req, res) => {
    const equipment = await Equipment.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: equipment });
});

export const getEquipmentById = asynchandler(async (req, res, next) => {
    const eq = await Equipment.findById(req.params.id).lean();
    if (!eq) return next(new AppError("Equipment not found", 404));

    // Get assignments for history and current project
    const assignments = await EquipmentAssignment.find({ equipment: eq._id })
        .populate("project", "name startDate")
        .populate("phase", "name")
        .lean();

    // Get maintenance for history
    const maintenanceLogs = await EquipmentMaintenance.find({ equipment: eq._id }).lean();

    // Stats calculations
    const totalMaintenanceCost = maintenanceLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
    // Rough mock revenue based on assigned days * dailyCost
    const totalRevenue = assignments.reduce((acc, a) => {
      // Mock: roughly 30 days active * dailyCost if active, or just a sample calc
      const activeMultiplier = a.status === "ACTIVE" ? 30 : 60;
      return acc + (eq.dailyCost * activeMultiplier * ((a.allocationPercentage || 100) / 100));
    }, 0);
    const netProfit = totalRevenue - totalMaintenanceCost;

    const currentAssignment = assignments.find(a => a.status === "ACTIVE");
    const utilizationRate = currentAssignment ? (currentAssignment.allocationPercentage || 100) : 0;

    return res.status(200).json({ 
      success: true, 
      data: {
        ...eq,
        stats: {
          totalRevenue,
          totalMaintenanceCost,
          netProfit,
          utilizationRate
        },
        currentAssignment: currentAssignment || null,
        history: assignments.map(a => ({
          project: a.project?.name,
          date: a.startDate || a.createdAt,
          status: a.status
        })),
        maintenanceLogs
      } 
    });
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
