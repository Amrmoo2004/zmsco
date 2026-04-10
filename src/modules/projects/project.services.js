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
import ProjectType from "../../db/models/settings/projectType.model.js";

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

  // 2. Fetch Blueprint for Defaults
  const projectTypeBlueprint = await ProjectType.findById(type).populate("defaultResources.materials.material");

  // 3. Create Nested Entities (Frontend-driven OR Auto-generator)
  if (phases && phases.length > 0) {
    await ProjectPhase.insertMany(phases.map(p => ({ ...p, project: project._id })));
  } else if (projectTypeBlueprint && projectTypeBlueprint.phases && projectTypeBlueprint.phases.length > 0) {
    // Auto-generate phases from ProjectType blueprint if frontend didn't send any
    const autoPhases = projectTypeBlueprint.phases.map(phase => {
        const requiredApprovals = phase.approvals ? phase.approvals.map(app => ({
          role: app.entity,
          isMandatory: app.isRequired
        })) : [];

        const requiredAttachments = phase.attachments ? phase.attachments.map(att => ({
          documentType: att.name,
          isMandatory: att.isRequired
        })) : [];

        const customFields = {};
        if (phase.fields) {
            phase.fields.forEach(f => {
                customFields[f.name] = ""; 
            });
        }

        const tasks = phase.tasks ? phase.tasks.map(t => ({
           name: t.name,
           description: t.description,
           status: "PENDING"
        })) : [];

        return {
          project: project._id,
          name: phase.name,
          order: phase.order,
          expectedDays: phase.expectedDays,
          isRequired: phase.isRequired,
          customFields,
          requiredAttachments,
          requiredApprovals,
          tasks
        };
      });
      await ProjectPhase.insertMany(autoPhases);
  }

  let finalBudget = budget || 0;

  // Process Materials
  let actualMaterials = materials;
  if ((!actualMaterials || actualMaterials.length === 0) && projectTypeBlueprint?.defaultResources?.materials) {
      actualMaterials = projectTypeBlueprint.defaultResources.materials.map(mat => {
          const materialObj = mat.material || {};
          const baseCost = materialObj.standardCost || 0;
          return {
              material: materialObj._id || mat.material,
              plannedQuantity: mat.quantity,
              unitCost: baseCost,
              totalCost: baseCost * mat.quantity
          };
      });
  }
  if (actualMaterials?.length > 0) {
      const materialsToInsert = actualMaterials.map(m => {
          const cost = m.totalCost || (m.unitCost ? m.unitCost * (m.plannedQuantity || m.quantity || 0) : 0);
          finalBudget += cost;
          return {
              ...m,
              project: project._id,
              material: m.material || m._id || m.materialId,
              unitCost: m.unitCost || 0,
              totalCost: cost
          };
      });
      await ProjectMaterial.insertMany(materialsToInsert);
  }

  // Process Equipment
  let actualEquipments = equipments;
  if ((!actualEquipments || actualEquipments.length === 0) && projectTypeBlueprint?.defaultResources?.equipments) {
      actualEquipments = projectTypeBlueprint.defaultResources.equipments.map(eq => ({
          name: eq.name,
          count: eq.count,
          unitCost: 0,
          totalCost: 0
      }));
  }
  if (actualEquipments?.length > 0) {
      await ProjectEquipment.insertMany(actualEquipments.map(e => {
          const cost = e.totalCost || (e.unitCost ? e.unitCost * e.count : 0);
          finalBudget += cost;
          return { ...e, project: project._id, totalCost: cost };
      }));
  }

  if (documents?.length > 0) {
    await ProjectDocument.insertMany(documents.map(d => ({ ...d, project: project._id, status: "PENDING" })));
  }

  // Process Members (Vacancies)
  let actualMembers = members;
  if ((!actualMembers || actualMembers.length === 0) && projectTypeBlueprint?.defaultResources?.employees) {
      actualMembers = [];
      projectTypeBlueprint.defaultResources.employees.forEach(emp => {
          for (let i = 0; i < emp.count; i++) {
              actualMembers.push({
                  jobTitle: emp.jobTitle,
                  role: "Project Member", // generic fallback or fetch JobTitle name
                  status: "VACANT",
                  estimatedCost: 0,
                  actualCost: 0
              });
          }
      });
  }
  if (actualMembers?.length > 0) {
      await ProjectMember.insertMany(actualMembers.map(m => {
          finalBudget += (m.estimatedCost || 0);
          return { ...m, project: project._id, status: m.status || "VACANT" };
      }));
  }

  if (finalBudget !== project.budget) {
      project.budget = finalBudget;
      await project.save();
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
    .populate("user", "name email"); // Optional: populate assigned user details

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

  // 3. assign and calculate cost
  const project = await ProjectModel.findById(projectId);
  let durationDays = 30; // default assumption
  if(project && project.startDate && project.endDate) {
      durationDays = Math.max(1, Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24)));
  }

  const newCost = (user.hourlyRate || 0) * 8 * durationDays;
  const oldCost = memberSlot.estimatedCost || 0;
  const costDiff = newCost - oldCost;

  memberSlot.user = userId;
  memberSlot.status = "FILLED";
  memberSlot.actualCost = newCost;
  await memberSlot.save();

  if(project) {
      project.budget = (project.budget || 0) + costDiff;
      await project.save();
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
