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
import Inventory from "../../db/models/inventory.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import Notification from "../../db/models/notification.model.js";

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
    dedicatedWarehouse, // ID of selected existing warehouse if SHARED or DEDICATED existing
    sourceWarehouse,
    initialTransfers = [],
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
    dedicatedWarehouse,
    sourceWarehouse,
    initialTransfers,
    createdBy: req.user.id
  });

  // 2. Fetch Blueprint for Defaults
  const projectTypeBlueprint = await ProjectType.findById(type).populate([
    { path: "defaultResources.materials.material" },
    { path: "defaultResources.employees.jobTitle" }
  ]);

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
          name: phase.nameAr || phase.nameEn || phase.name || "مرحلة",
          nameAr: phase.nameAr,
          nameEn: phase.nameEn,
          color: phase.color,
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

  let estimatedCost = 0;

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
          const qty = m.plannedQuantity || m.quantity || 0;
          const cost = m.totalCost || (m.unitCost ? m.unitCost * qty : 0);
          estimatedCost += cost;
          return {
              ...m,
              project: project._id,
              material: m.material || m._id || m.materialId,
              plannedQuantity: qty,
              issuedQuantity: 0, // No material is issued at creation step
              unitCost: m.unitCost || 0,
              totalCost: cost
          };
      });
      await ProjectMaterial.insertMany(materialsToInsert);
  }

  const projectDurationDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) || 1;

  // Process Equipment
  let actualEquipments = equipments;
  if ((!actualEquipments || actualEquipments.length === 0) && projectTypeBlueprint?.defaultResources?.equipments) {
      actualEquipments = projectTypeBlueprint.defaultResources.equipments.map(eq => {
          const estimatedCost = eq.estimatedDailyCost || 0;
          const totalEqCost = estimatedCost * projectDurationDays * eq.count;
          return {
              name: eq.name,
              count: eq.count,
              unit: eq.unit || "وحدة",
              ownershipType: "OWNED",
              unitCost: estimatedCost * projectDurationDays,
              totalCost: totalEqCost
          };
      });
  }
  if (actualEquipments?.length > 0) {
      await ProjectEquipment.insertMany(actualEquipments.map(e => {
          const cost = e.totalCost || (e.unitCost ? e.unitCost * e.count : 0);
          estimatedCost += cost;
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
          const jobTitleDoc = emp.jobTitle || {};
          const dailyCost = jobTitleDoc.estimatedDailyCost || 0;
          const estCost = dailyCost * projectDurationDays;

          for (let i = 0; i < emp.count; i++) {
              actualMembers.push({
                  jobTitle: jobTitleDoc._id || emp.jobTitle,
                  role: "Project Member",
                  status: "VACANT",
                  estimatedCost: estCost,
                  actualCost: 0
              });
          }
      });
  }
  if (actualMembers?.length > 0) {
      await ProjectMember.insertMany(actualMembers.map(m => {
          estimatedCost += (m.estimatedCost || 0);
          return { ...m, project: project._id, status: m.status || "VACANT" };
      }));
  }

  project.estimatedCost = estimatedCost;
  await project.save();

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
    .populate("user", "name email");

  const materials = await ProjectMaterial.find({ project: req.params.id })
    .populate("material", "name unit");

  const equipments = await ProjectEquipment.find({ project: req.params.id });

  const phases = await ProjectPhase.find({ project: req.params.id }).sort({ order: 1 });

  return res.status(200).json({
    success: true,
    data: { 
      ...project.toObject(), 
      members,
      materials,
      equipments,
      phases
    }
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

  const { initialTransfers: reqTransfers } = req.body;
  
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

  const targetWarehouseId = project.dedicatedWarehouse;

  // Process Initial Transfers if provided either in draft or currently in payload
  const transfersToProcess = reqTransfers || project.initialTransfers || [];

  if (transfersToProcess.length > 0 && targetWarehouseId) {
      for (const transfer of transfersToProcess) {
          const { material, quantity, fromWarehouse } = transfer;
          if (!material || !quantity || !fromWarehouse) continue;

          // 1. Deduct from Source Warehouse Inventory
          let sourceInv = await Inventory.findOne({ warehouse: fromWarehouse, material });
          if (!sourceInv || sourceInv.quantity < quantity) {
              const deficit = quantity - (sourceInv ? sourceInv.quantity : 0);
              
              // Skip the transfer and notify manager instead of crashing project creation
              await Notification.create({
                  user: project.manager || req.user.id,
                  title: "عجز في المخزون لنقل المواد الأولية",
                  body: `تم تجاوز نقل ${quantity} وحدة من المادة (${material}) بسبب عجز قدره ${deficit} وحدة في المستودع المغذي. يرجى مراجعة المخزون لإتمام النقل يدوياً.`,
                  type: "WARNING",
                  data: { projectId: project._id, materialId: material, deficit }
              });

              continue; // Skip this specific transfer and process the rest
          }
          sourceInv.quantity -= quantity;
          await sourceInv.save();

          // 2. Add to Target (Project) Warehouse Inventory
          let targetInv = await Inventory.findOne({ warehouse: targetWarehouseId, material });
          if (!targetInv) {
              targetInv = new Inventory({
                  warehouse: targetWarehouseId,
                  material,
                  quantity: 0
              });
          }
          targetInv.quantity += quantity;
          await targetInv.save();

          // 3. Log the Transaction
          await MaterialTransaction.create({
              material,
              project: project._id,
              type: "TRANSFER",
              quantity,
              fromWarehouse,
              toWarehouse: targetWarehouseId,
              processedBy: req.user.id,
              reference: `Initial transfer for project ${project.code}`,
              status: "COMPLETED"
          });
      }
  }

  // Activate
  project.status = "PLANNING";
  await project.save();

  return res.status(200).json({
    success: true,
    message: "Project activated successfully and initial transfers processed.",
    data: project
  });
});

/**
 * UPDATE PHASE STATUS
 * Simple endpoint for frontend to transition a phase between PENDING, IN_PROGRESS, and COMPLETED
 */
export const update_phase_status = asynchandler(async (req, res, next) => {
  const { id: projectId, phaseId } = req.params;
  const { status } = req.body;

  if (!["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return next(new AppError("Invalid status value.", 400));
  }

  const phase = await ProjectPhase.findOneAndUpdate(
      { _id: phaseId, project: projectId },
      { status },
      { new: true }
  );

  if (!phase) {
      return next(new AppError("Phase not found.", 404));
  }

  return res.status(200).json({
      success: true,
      message: `Phase status updated to ${status}`,
      data: phase
  });
});
