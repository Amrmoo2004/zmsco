import ProjectModel from "../../db/models/projects/project.js";
import { asynchandler } from "../../utils/response/response.js";
import { AppError } from "../../utils/appError.js";
import ProjectMember from "../../db/models/projects/project.member.js";
import User from "../../db/models/user.js";
import Warehouse from "../../db/models/warehouse.model.js";
import ProjectPhase from "../../db/models/projects/project.phase.js";
import ProjectDocument from "../../db/models/projects/project.document.js";
import ProjectMaterial from "../../db/models/metrials/projectMaterial.model.js";
import ProjectEquipment from "../../db/models/projects/project.equipment.js";
import { Equipment } from "../../db/models/hr/equipment.model.js";
import ProjectType from "../../db/models/settings/projectType.model.js";
import Inventory from "../../db/models/inventory.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import Notification from "../../db/models/notification.model.js";
import { createNotification } from "../notifications/notification.service.js";

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

  if (!name || !type || !manager) {
    return next(new AppError("المشروع يحتاج اسم، نوع، ومدير مشروع", 400));
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
    // ── Find the lowest order to auto-open that phase ──
    const orders     = phases.map(p => p.order ?? 1);
    const firstOrder = Math.min(...orders);

    await ProjectPhase.insertMany(phases.map(p => {
      const phaseOrder = p.order ?? 1;
      return {
        ...p,
        project:   project._id,
        name:      p.name || p.nameAr || p.nameEn || "مرحلة",
        order:     phaseOrder,
        // ── أوتوماتيك: أفتح أول مرحلة فقط ──
        status:    phaseOrder === firstOrder ? "IN_PROGRESS" : "PENDING",
        startDate: phaseOrder === firstOrder ? (p.startDate || new Date()) : p.startDate
      };
    }));
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

      const requiredPermits = phase.permits ? phase.permits.map(p => ({
        name: p.name,
        isMandatory: p.isRequired
      })) : [];

      const phaseOrders = projectTypeBlueprint.phases.map(ph => ph.order ?? 1);
      const firstBlueprintOrder = Math.min(...phaseOrders);

      return {
        project:    project._id,
        name:       phase.nameAr || phase.nameEn || "مرحلة",
        nameAr:     phase.nameAr,
        nameEn:     phase.nameEn,
        color:      phase.color,
        order:      phase.order,
        expectedDays: phase.expectedDays,
        // ── أفتح أول مرحلة (الأصغر order) فقط ──
        status:     phase.order === firstBlueprintOrder ? "IN_PROGRESS" : "PENDING",
        isRequired: phase.isRequired,
        customFields,
        requiredAttachments,
        requiredApprovals,
        requiredPermits,
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
      // Destructure _id out to prevent MongoDB duplicate key error when frontend sends full material objects
      const { _id, materialId, material: materialRef, ...rest } = m;
      const resolvedMaterialId = materialRef || _id || materialId;
      const qty = rest.plannedQuantity || rest.quantity || 0;
      const cost = rest.totalCost || (rest.unitCost ? rest.unitCost * qty : 0);
      estimatedCost += cost;
      return {
        ...rest,
        project: project._id,
        material: resolvedMaterialId,
        plannedQuantity: qty,
        issuedQuantity: 0,
        unitCost: rest.unitCost || 0,
        totalCost: cost
      };
    });
    await ProjectMaterial.insertMany(materialsToInsert);
  }

  const projectDurationDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) || 1;

  // Process Equipment — supports TWO modes (same as materials):
  // Mode 1: { equipmentId: ObjectId } → Reference from /api/equipment fleet
  // Mode 2: { name, count, unitCost }  → Free-form manual entry
  let actualEquipments = equipments;
  if ((!actualEquipments || actualEquipments.length === 0) && projectTypeBlueprint?.defaultResources?.equipments) {
    actualEquipments = projectTypeBlueprint.defaultResources.equipments.map(eq => ({
      name: eq.name,
      count: eq.count || 1,
      unit: eq.unit || "وحدة",
      ownershipType: "OWNED",
      unitCost: (eq.estimatedDailyCost || 0) * projectDurationDays,
      totalCost: (eq.estimatedDailyCost || 0) * projectDurationDays * (eq.count || 1)
    }));
  }
  if (actualEquipments?.length > 0) {
    const equipmentDocs = await Promise.all(actualEquipments.map(async e => {
      let resolvedName = e.name;
      let resolvedUnitCost = e.unitCost || 0;
      let equipmentRef = null;

      // Mode 1: lookup from fleet
      if (e.equipmentId) {
        const fleetItem = await Equipment.findById(e.equipmentId);
        if (fleetItem) {
          equipmentRef = fleetItem._id;
          resolvedName = fleetItem.name;
          resolvedUnitCost = e.unitCost ?? (fleetItem.dailyCost * projectDurationDays);
        }
      }

      const qty = e.count || 1;
      const cost = e.totalCost ?? (resolvedUnitCost * qty);
      estimatedCost += cost;

      return {
        project: project._id,
        equipmentRef,
        name: resolvedName || "معدة",
        count: qty,
        unit: e.unit || "وحدة",
        ownershipType: e.ownershipType || "OWNED",
        unitCost: resolvedUnitCost,
        totalCost: cost
      };
    }));
    await ProjectEquipment.insertMany(equipmentDocs);
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

  // If frontend sends skipActivation: true and warehouseType is SHARED → go directly to PLANNING
  if (req.body.skipActivation && (!warehouseType || warehouseType === "SHARED")) {
    project.status = "PLANNING";
    await project.save();

    // ── عند skipActivation: افتح أول مرحلة فقط (Gating) ──────────────
    const veryFirst = await ProjectPhase.findOne({ project: project._id })
      .sort({ order: 1 });
    if (veryFirst) {
      await ProjectPhase.updateOne(
        { _id: veryFirst._id },
        { $set: { status: "IN_PROGRESS", startDate: veryFirst.startDate || new Date() } }
      );
      // Make sure all OTHER phases stay PENDING
      await ProjectPhase.updateMany(
        { project: project._id, _id: { $ne: veryFirst._id } },
        { $set: { status: "PENDING" } }
      );
    }
  } else {
    await project.save();
  }

  return res.status(201).json({
    success: true,
    message: project.status === "PLANNING"
      ? "Project created and activated successfully."
      : "Project draft created. Use /activate to finalize.",
    data: project
  });

});
export const get_projects = asynchandler(async (req, res, next) => {
  // ARCHIVED projects are excluded from the normal listing — use GET /projects/archived instead
  let query = { isActive: true, status: { $ne: "ARCHIVED" } };

  // ── Search & Filter from query params ──────────────────────────────────────
  const { search, status, priority, manager, type } = req.query;
  if (search) {
    query.$or = [
      { name:  { $regex: search, $options: "i" } },
      { code:  { $regex: search, $options: "i" } },
      { client:{ $regex: search, $options: "i" } },
    ];
  }
  if (status)   query.status   = status;
  if (priority) query.priority  = priority;
  if (manager)  query.manager   = manager;
  if (type)     query.type      = type;

  // If normal user, limit to their projects
  if (req.user.role !== "ADMIN") {
    const assignments = await ProjectMember.find({ user: req.user._id }).select("project");
    const assignedProjectIds = assignments.map(a => a.project);
    const roleFilter = [
      { _id: { $in: assignedProjectIds } },
      { manager: req.user._id }
    ];
    // Merge with existing $or if search is used
    query.$and = query.$and || [];
    query.$and.push({ $or: roleFilter });
    delete query.$or;
  }

  const projects = await ProjectModel.find(query)
    .populate("manager", "username email name")
    .lean()
    .sort({ createdAt: -1 });

  const projectIds = projects.map(p => p._id);
  const phases = await ProjectPhase.find({ project: { $in: projectIds } }, "project tasks");

  const formattedProjects = projects.map(project => {
    const pPhases = phases.filter(ph => ph.project?.toString() === project._id.toString());
    let totalTasks = 0;
    let completedTasks = 0;

    pPhases.forEach(ph => {
      if (ph.tasks) {
        totalTasks += ph.tasks.length;
        completedTasks += ph.tasks.filter(t => t.status === "COMPLETED").length;
      }
    });

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let displayStatus = project.status;
    if (project.endDate && new Date(project.endDate) < new Date() && project.status !== "COMPLETED") {
      displayStatus = "DELAYED";
    }

    return {
      ...project,
      progress,
      displayStatus
    };
  });

  // ── Summary stats for Dashboard cards ────────────────────────────────────
  const stats = {
    total:     formattedProjects.length,
    active:    formattedProjects.filter(p => p.status === "PLANNING" || p.displayStatus === "DELAYED").length,
    planning:  formattedProjects.filter(p => p.status === "PLANNING").length,
    completed: formattedProjects.filter(p => p.status === "COMPLETED").length,
    onHold:    formattedProjects.filter(p => p.status === "ON_HOLD").length,
    delayed:   formattedProjects.filter(p => p.displayStatus === "DELAYED").length,
    draft:     formattedProjects.filter(p => p.status === "DRAFT").length,
  };

  return res.status(200).json({
    success: true,
    stats,
    data: formattedProjects
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
  if (project && project.startDate && project.endDate) {
    durationDays = Math.max(1, Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24)));
  }

  const newCost = (user.hourlyRate || 0) * 8 * durationDays;
  const oldCost = memberSlot.estimatedCost || 0;
  const costDiff = newCost - oldCost;

  memberSlot.user = userId;
  memberSlot.status = "FILLED";
  memberSlot.actualCost = newCost;
  await memberSlot.save();

  if (project) {
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

  // Allow activation from DRAFT or re-activation to fix locked phases on PLANNING projects
  if (!['DRAFT', 'PLANNING'].includes(project.status)) {
    return next(new AppError("يمكن تفعيل المشروع فقط من حالة DRAFT أو PLANNING", 400));
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

  // 4. Open only the FIRST phase (lowest order) — don't hardcode order:1
  const firstPhase = await ProjectPhase.findOne({ project: project._id, status: "PENDING" })
    .sort({ order: 1 });

  if (firstPhase) {
    firstPhase.status    = "IN_PROGRESS";
    firstPhase.startDate = firstPhase.startDate || new Date();
    await firstPhase.save();
  }

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

/**
 * GET PHASE DETAILS (Screen 2 — شاشة تفاصيل المرحلة)
 * يُرجع إحصائيات محسوبة للـ UI:
 *   statistics.tasks       → { completed, total }   ← "التزامات المكتملة"
 *   statistics.attachments → { uploaded, total }    ← "المرفقات المضافة"
 *   statistics.approvals   → { approved, total }    ← "اشتراك الأدوار"
 *   statistics.progress    → نسبة الإنجاز الكلية %
 *   statistics.canComplete → هل يمكن الضغط على "الانتقال إلى المرحلة"؟
 */
export const get_phase_details = asynchandler(async (req, res, next) => {
  const { id: projectId, phaseId } = req.params;

  const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId })
    .populate('requiredApprovals.user', 'name')
    .populate('requiredAttachments.attachmentId', 'url name')
    .lean();

  if (!phase) return next(new AppError('Phase not found.', 404));

  // ── إحصائيات المهام
  const totalTasks = (phase.tasks || []).length;
  const completedTasks = (phase.tasks || []).filter(t => t.status === 'COMPLETED').length;

  // ── إحصائيات المرفقات
  const totalAttachments = (phase.requiredAttachments || []).length;
  const uploadedAttachments = (phase.requiredAttachments || []).filter(a => !!a.attachmentId).length;

  // ── إحصائيات الموافقات
  const totalApprovals = (phase.requiredApprovals || []).length;
  const approvedApprovals = (phase.requiredApprovals || []).filter(a => a.status === 'APPROVED').length;

  // ── نسبة الإنجاز (مهام 60% + مرفقات 20% + موافقات 20%)
  const taskPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const attachPct = totalAttachments > 0 ? (uploadedAttachments / totalAttachments) * 100 : 100;
  const approvalPct = totalApprovals > 0 ? (approvedApprovals / totalApprovals) * 100 : 100;
  const progress = Math.round(taskPct * 0.6 + attachPct * 0.2 + approvalPct * 0.2);

  const canComplete =
    completedTasks === totalTasks &&
    uploadedAttachments === totalAttachments &&
    approvedApprovals === totalApprovals;

  return res.status(200).json({
    success: true,
    data: {
      ...phase,
      statistics: {
        progress,
        canComplete,
        tasks: { completed: completedTasks, total: totalTasks },
        attachments: { uploaded: uploadedAttachments, total: totalAttachments },
        approvals: { approved: approvedApprovals, total: totalApprovals }
      }
    }
  });
});

/**
 * GET ARCHIVED PROJECTS
 * Returns only projects with status === ARCHIVED for the archive listing screen.
 */
export const get_archived_projects = asynchandler(async (req, res, next) => {
  const projects = await ProjectModel.find({
    isActive: true,
    status: "ARCHIVED"
  })
    .populate("manager", "name email")
    .lean()
    .sort({ archivedAt: -1 });

  const projectIds = projects.map(p => p._id);

  // Fetch phases for progress calculation
  const phases = await ProjectPhase.find({ project: { $in: projectIds } }, "project tasks").lean();

  const formatted = projects.map(project => {
    const pPhases = phases.filter(ph => ph.project?.toString() === project._id.toString());
    let totalTasks = 0;
    let completedTasks = 0;
    pPhases.forEach(ph => {
      if (ph.tasks) {
        totalTasks += ph.tasks.length;
        completedTasks += ph.tasks.filter(t => t.status === "COMPLETED").length;
      }
    });
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    const finalCost = project.estimatedCost || 0;
    const savings = (project.budget || 0) - finalCost;
    const savingsPercent = project.budget > 0 ? Math.round(savings / project.budget * 100) : 0;

    return {
      _id: project._id,
      name: project.name,
      code: project.code,
      status: "ARCHIVED",
      archivedAt: project.archivedAt,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: project.budget,
      finalCost,
      savings,
      savingsPercent: `${savingsPercent}%`,
      manager: project.manager,
      progress,
      client: project.client
    };
  });

  return res.status(200).json({
    success: true,
    total: formatted.length,
    data: formatted
  });
});

/**
 * COMPLETE PHASE  (Screen 2 — زر "الانتقال إلى المرحلة")
 * يتحقق من المهام + الموافقات + المرفقات ثم يكمل المرحلة ويفتح التالية
 */
export const completePhase = asynchandler(async (req, res, next) => {
  const { id: projectId, phaseId } = req.params;
  const { force = false } = req.body;

  const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
  if (!phase) return next(new AppError("المرحلة غير موجودة", 404));
  if (phase.status === "COMPLETED") return next(new AppError("المرحلة مكتملة بالفعل", 400));

  if (!force) {
    const incompleteTasks = (phase.tasks || []).filter(
      t => t.isRequired !== false && t.status !== "COMPLETED" && t.status !== "CANCELLED"
    );
    if (incompleteTasks.length > 0) {
      return next(new AppError(`لا يمكن إكمال المرحلة — يوجد ${incompleteTasks.length} مهمة غير مكتملة`, 400));
    }

    const pendingApprovals = (phase.requiredApprovals || []).filter(
      a => a.isMandatory !== false && a.status !== "APPROVED"
    );
    if (pendingApprovals.length > 0) {
      return next(new AppError(`لا يمكن إكمال المرحلة — يوجد ${pendingApprovals.length} موافقة معلقة`, 400));
    }

    const pendingAttachments = (phase.requiredAttachments || []).filter(
      a => a.isMandatory !== false && a.reviewStatus !== "APPROVED"
    );
    if (pendingAttachments.length > 0) {
      return next(new AppError(`لا يمكن إكمال المرحلة — يوجد ${pendingAttachments.length} مرفق لم تتم مراجعته`, 400));
    }
  }

  // ── إكمال المرحلة الحالية ────────────────────────────────────────────
  phase.status  = "COMPLETED";
  phase.endDate = phase.endDate || new Date();
  await phase.save();

  // ── فتح المرحلة التالية تلقائياً ─────────────────────────────────────
  const nextPhase = await ProjectPhase.findOne({
    project: projectId,
    order:   phase.order + 1,
    status:  { $in: ["PENDING", "IN_PROGRESS"] }
  }).sort({ order: 1 });

  let nextPhaseData = null;
  if (nextPhase && nextPhase.status === "PENDING") {
    nextPhase.status    = "IN_PROGRESS";
    nextPhase.startDate = nextPhase.startDate || new Date();
    await nextPhase.save();
    nextPhaseData = { _id: nextPhase._id, name: nextPhase.nameAr || nextPhase.name, order: nextPhase.order };
  } else if (nextPhase) {
    nextPhaseData = { _id: nextPhase._id, name: nextPhase.nameAr || nextPhase.name, order: nextPhase.order };
  }

  // ── هل اكتملت كل المراحل؟ ────────────────────────────────────────────
  const remainingPhases = await ProjectPhase.countDocuments({
    project: projectId,
    status:  { $ne: "COMPLETED" }
  });

  // ── Notifications ─────────────────────────────────────────────────────
  const project = await ProjectModel.findById(projectId).lean();
  const managerId = project?.manager;

  if (managerId) {
    if (remainingPhases === 0) {
      // 🎉 المشروع كله اتكمل
      await createNotification(
        managerId,
        "🎉 اكتمل المشروع بنجاح!",
        `تم إكمال جميع مراحل مشروع "${project.name}" بنجاح. يمكنك الآن بدء إجراءات الإغلاق.`,
        "SUCCESS",
        { projectId, type: "PROJECT_COMPLETED" }
      );
    } else if (nextPhaseData) {
      // ➡️ مرحلة اتكملت ومرحلة جديدة فتحت
      await createNotification(
        managerId,
        `✅ اكتملت مرحلة: ${phase.nameAr || phase.name}`,
        `تم إكمال المرحلة وفتح المرحلة التالية "${nextPhaseData.name}" في مشروع "${project.name}".`,
        "INFO",
        { projectId, phaseId: phase._id, nextPhaseId: nextPhaseData._id, type: "PHASE_COMPLETED" }
      );
    }
  }

  if (remainingPhases === 0) {
    await ProjectModel.findByIdAndUpdate(projectId, {
      status: "COMPLETED",
      completionDate: new Date()
    });
  }

  return res.status(200).json({
    success: true,
    message: nextPhaseData
      ? `تم إكمال المرحلة وفتح المرحلة التالية: ${nextPhaseData.name}`
      : "تم إكمال آخر مرحلة في المشروع",
    data: {
      completedPhase:   { _id: phase._id, name: phase.nameAr || phase.name, status: phase.status },
      nextPhase:        nextPhaseData,
      projectCompleted: remainingPhases === 0
    }
  });
});
