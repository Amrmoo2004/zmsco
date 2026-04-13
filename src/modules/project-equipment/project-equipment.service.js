import ProjectEquipment from "../../db/models/projects/project.equipment.js";
import Project from "../../db/models/projects/project.js";
import { Equipment } from "../../db/models/hr/equipment.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/** Get project equipment */
export const getProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    const equipment = await ProjectEquipment.find({ project: projectId })
        .populate("equipmentRef", "name type brand condition dailyCost")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: equipment });
});

/**
 * Add equipment to project — supports two modes (like materials):
 * Mode 1: { equipmentId: ObjectId, count, startDate, endDate } → pulls name + dailyCost from fleet
 * Mode 2: { name, count, unitCost } → free-form manual entry
 */
export const addProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId } = req.params;
    const {
        equipmentId,   // Mode 1: reference from /api/equipment
        name,          // Mode 2: free-form
        count = 1,
        unit = "وحدة",
        ownershipType = "OWNED",
        location,
        unitCost,
        totalCost,
        startDate,
        endDate,
        status
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return next(new AppError("Project not found", 404));

    let resolvedName = name;
    let resolvedUnitCost = unitCost || 0;
    let equipmentRef = null;

    // ─── Mode 1: Reference from Equipment Fleet ────────────────────────────────
    if (equipmentId) {
        const fleetItem = await Equipment.findById(equipmentId);
        if (!fleetItem) return next(new AppError("Equipment not found in fleet. Use GET /api/equipment to browse.", 404));
        if (!fleetItem.isActive) return next(new AppError("This equipment is inactive", 400));

        equipmentRef = fleetItem._id;
        resolvedName = fleetItem.name;

        // Calculate cost from dailyCost × project duration (or custom range)
        const from = startDate ? new Date(startDate) : (project.startDate || new Date());
        const to = endDate ? new Date(endDate) : (project.endDate || new Date());
        const days = Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
        resolvedUnitCost = unitCost ?? (fleetItem.dailyCost * days);
    }

    if (!resolvedName) return next(new AppError("Equipment name is required (or pass equipmentId)", 400));

    const computedTotal = totalCost ?? (resolvedUnitCost * count);

    const equipment = await ProjectEquipment.create({
        project: projectId,
        equipmentRef,
        name: resolvedName,
        count,
        unit,
        ownershipType,
        location,
        unitCost: resolvedUnitCost,
        totalCost: computedTotal,
        status: status || "PENDING"
    });

    // Update project estimatedCost
    project.estimatedCost = (project.estimatedCost || 0) + computedTotal;
    await project.save();

    await equipment.populate("equipmentRef", "name type brand condition dailyCost");

    return res.status(201).json({
        success: true,
        message: "Equipment added to project successfully",
        data: equipment
    });
});

/** Update equipment */
export const updateProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;
    const { name, count, unit, ownershipType, location, unitCost, totalCost, status } = req.body;

    const equipment = await ProjectEquipment.findOne({ _id: id, project: projectId });
    if (!equipment) return next(new AppError("Equipment not found in this project", 404));

    const oldCost = equipment.totalCost || 0;

    if (name) equipment.name = name;
    if (count !== undefined) equipment.count = count;
    if (unit) equipment.unit = unit;
    if (ownershipType) equipment.ownershipType = ownershipType;
    if (location !== undefined) equipment.location = location;
    if (unitCost !== undefined) equipment.unitCost = unitCost;
    if (status) equipment.status = status;

    // Recalculate totalCost if count or unitCost changed
    const newTotal = totalCost ?? ((equipment.unitCost || 0) * (equipment.count || 1));
    equipment.totalCost = newTotal;

    await equipment.save();

    // Update project estimatedCost
    const project = await Project.findById(projectId);
    if (project) {
        project.estimatedCost = (project.estimatedCost || 0) - oldCost + newTotal;
        await project.save();
    }

    return res.status(200).json({
        success: true,
        message: "Equipment updated successfully",
        data: equipment
    });
});

/** Remove equipment from project */
export const removeProjectEquipment = asynchandler(async (req, res, next) => {
    const { projectId, id } = req.params;

    const equipment = await ProjectEquipment.findOne({ _id: id, project: projectId });
    if (!equipment) return next(new AppError("Equipment not found in this project", 404));

    const cost = equipment.totalCost || 0;
    await equipment.deleteOne();

    // Deduct from estimatedCost
    const project = await Project.findById(projectId);
    if (project) {
        project.estimatedCost = Math.max(0, (project.estimatedCost || 0) - cost);
        await project.save();
    }

    return res.status(200).json({
        success: true,
        message: "Equipment removed from project successfully"
    });
});
