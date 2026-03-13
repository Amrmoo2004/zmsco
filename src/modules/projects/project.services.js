import ProjectModel from "../../db/models/projects/project.js";
import { asynchandler } from "../../utils/response/response.js";

import { AppError } from "../../utils/appError.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import User from "../../db/models/user.js";
import Warehouse from "../../db/models/warehouse.model.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
import ProjectDocument from "../../db/models/projects/project.document.js";
import ProjectMaterial from "../../db/models/metrials/📁 projectMaterial.model.js";
import ProjectEquipment from "../../db/models/projects/project.equipment.js";

/**
 * CREATE PROJECT
 */
export const create_project = asynchandler(async (req, res, next) => {
  const {
    name,
    type,
    priority,
    budget,
    startDate,
    endDate,
    manager,
    department,
    client,
    description,
    warehouseType, // 'SHARED' or 'DEDICATED'
    phases = [],
    materials = [],
    equipments = [],
    documents = [],
    members = []
  } = req.body;

  if (!name ||  !manager) {
    return next(new Error("Missing required fields", { cause: 400 }));
  }

  // auto project code
  const projectCode = `PR-${Date.now()}`;

  // 1. Create Project
  const project = await ProjectModel.create({
    name,
    code: projectCode,
    type,
    priority,
    budget,
    startDate,
    endDate,
    manager,
    department,
    client,
    description,
    warehouseType,
    createdBy: req.user.id
  });

  // 2. Create Nested Entities (Frontend-driven Blueprint)
  if (phases?.length > 0) {
    await ProjectPhase.insertMany(phases.map(p => ({ ...p, project: project._id })));
  }
  if (materials?.length > 0) {
    // Some frontend schemas might use material._id vs material
    await ProjectMaterial.insertMany(materials.map(m => ({
      ...m,
      project: project._id,
      material: m.material || m._id || m.materialId
    })));
  }
  if (equipments?.length > 0) {
    await ProjectEquipment.insertMany(equipments.map(e => ({ ...e, project: project._id })));
  }
  if (documents?.length > 0) {
    await ProjectDocument.insertMany(documents.map(d => ({ ...d, project: project._id, status: "PENDING" })));
  }
  if (members?.length > 0) {
    await ProjectMember.insertMany(members.map(m => ({ ...m, project: project._id, status: "VACANT" })));
  }

  return res.status(201).json({
    success: true,
    message: "Project draft created. Use /activate to finalize.",
    data: project
  });

});
export const get_projects = asynchandler(async (req, res, next) => {
  const projects = await ProjectModel.find({ isActive: true })
    .populate("manager", "username email")
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: projects
  });
});

/**
 * GET SINGLE PROJECT
 */
export const get_project = asynchandler(async (req, res, next) => {
  const project = await ProjectModel.findById(req.params.id)
    .populate("manager", "username email");

  if (!project) {
    return next(new Error("Project not found", { cause: 404 }));
  }

  const members = await ProjectMember.find({ project: req.params.id })
    .populate("assignedUser", "name email"); // Optional: populate assigned user details

  return res.status(200).json({
    success: true,
    data: { ...project.toObject(), members }
  });
});

/**
 * UPDATE PROJECT
 */
export const update_project = asynchandler(async (req, res, next) => {
  const project = await ProjectModel.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  if (!project) {
    return next(new Error("Project not found", { cause: 404 }));
  }

  return res.status(200).json({
    success: true,
    message: "Project updated successfully",
    data: project
  });
});

/**
 * DELETE PROJECT (soft delete)
 */
export const delete_project = asynchandler(async (req, res, next) => {
  const project = await ProjectModel.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!project) {
    return next(new Error("Project not found", { cause: 404 }));
  }

  return res.status(200).json({
    success: true,
    message: "Project deleted successfully"
  });

});

/**
 * ASSIGN MEMBER TO PROJECT
 */
export const assign_member = asynchandler(async (req, res, next) => {
  const { id: projectId, memberId } = req.params;
  const { userId } = req.body;

  // 1. تأكد إن اليوزر موجود
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // 2. تأكد إن الـ vacancy تبع المشروع
  const memberSlot = await ProjectMember.findOne({
    _id: memberId,
    project: projectId,
    status: "VACANT"
  });

  if (!memberSlot) {
    return next(new AppError("Member vacancy not found or already filled", 404));
  }

  // 3. assign
  memberSlot.assignedUser = userId;
  memberSlot.status = "FILLED";
  await memberSlot.save();

  // 4. Update User Role (If vacancy has a systemRole)
  if (memberSlot.systemRole) {
    await User.findByIdAndUpdate(
      userId,
      { role: memberSlot.systemRole },
      { new: true }
    );
  }

  res.status(200).json({
    success: true,
    message: "Member assigned successfully",
    data: memberSlot
  });
});

/**
 * GET PROJECT SUMMARY (Review screen - Step 6)
 */
export const get_project_summary = asynchandler(async (req, res, next) => {
  const { id } = req.params;

  const project = await ProjectModel.findById(id)
    .populate("manager", "username email")
    .populate("department")
    .lean();

  if (!project) return next(new AppError("Project not found", 404));

  const [phases, members, materials, equipment, documents] = await Promise.all([
    ProjectPhase.find({ project: id }).lean(),
    ProjectMember.find({ project: id }).populate("user", "username email").lean(),
    ProjectMaterial.find({ project: id }).populate("material", "name unit").lean(),
    ProjectEquipment.find({ project: id }).lean(),
    ProjectDocument.find({ project: id }).lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      project,
      phases,
      members,
      materials,
      equipment,
      documents,
    }
  });
});

/**
 * ACTIVATE PROJECT (Final Submit - Step 6)
 * Validates and moves project from DRAFT → PLANNING
 */
export const activate_project = asynchandler(async (req, res, next) => {
  const project = await ProjectModel.findById(req.params.id);

  if (!project) return next(new AppError("Project not found", 404));

  if (project.status !== "DRAFT") {
    return next(new AppError("Project is not in DRAFT status", 400));
  }

  // Validate required fields before activation
  if (!project.manager) {
    return next(new AppError("Project must have a manager before activation", 400));
  }

  // Handle Dedicated Warehouse (if not already created)
  if (project.warehouseType === "DEDICATED" && !project.dedicatedWarehouse) {
    const warehouse = await Warehouse.create({
      name: `${project.name} Warehouse`,
      location: `Site: ${project.location || "Project Site"}`,
      type: "PROJECT",
      project: project._id,
      manager: project.manager
    });
    project.dedicatedWarehouse = warehouse._id;
  }

  // Activate
  project.status = "PLANNING";
  await project.save();

  return res.status(200).json({
    success: true,
    message: "Project activated successfully",
    data: project
  });
});
