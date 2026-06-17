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
import { uploadToCloudinary } from "../../utils/cloudinary.js";
import { calculatePhaseStatistics } from "../../utils/phaseUtils.js";
import { emitToProject, emitDashboardUpdate } from "../../utils/socket.js";

/**
 * CREATE PROJECT
 */
export const create_project = asynchandler(async (req, res, next) => {
  let parsedBody = { ...req.body };
  ['phases', 'materials', 'equipments', 'documents', 'members', 'initialTransfers'].forEach(field => {
    if (typeof parsedBody[field] === 'string') {
      try { parsedBody[field] = JSON.parse(parsedBody[field]); } catch (e) { parsedBody[field] = []; }
    }
  });
  if (typeof parsedBody.skipActivation === 'string') parsedBody.skipActivation = parsedBody.skipActivation === 'true';
  if (typeof parsedBody.budget === 'string') parsedBody.budget = Number(parsedBody.budget);
  // Default: stay DRAFT unless caller explicitly sets skipActivation: false (meaning "activate now")
  // skipActivation: true  (or omitted) → create DRAFT only
  // skipActivation: false               → create + activate immediately
  const activateNow = parsedBody.skipActivation === false;

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
  } = parsedBody;

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
    const orders = phases.map(p => p.order ?? 1);
    const firstOrder = Math.min(...orders);

    await ProjectPhase.insertMany(phases.map(p => {
      const phaseOrder = p.order ?? 1;
      return {
        ...p,
        project: project._id,
        name: p.name || p.nameAr || p.nameEn || "مرحلة",
        order: phaseOrder,
        // ── أوتوماتيك: أفتح أول مرحلة فقط ──
        status: phaseOrder === firstOrder ? "IN_PROGRESS" : "PENDING",
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
        issuingAuthority: p.issuingAuthority || "",
        authorityType: p.authorityType || "الجهة التنظيمية",
        expiryDate: p.expiryDate || null,
        permitNumber: "",
        isMandatory: p.isRequired
      })) : [];

      const phaseOrders = projectTypeBlueprint.phases.map(ph => ph.order ?? 1);
      const firstBlueprintOrder = Math.min(...phaseOrders);

      return {
        project: project._id,
        name: phase.nameAr || phase.nameEn || "مرحلة",
        nameAr: phase.nameAr,
        nameEn: phase.nameEn,
        color: phase.color,
        order: phase.order,
        expectedDays: phase.expectedDays,
        // ── أفتح أول مرحلة (الأصغر order) فقط ──
        status: phase.order === firstBlueprintOrder ? "IN_PROGRESS" : "PENDING",
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

  // Handle physically uploaded files in multipart/form-data
  if (req.files && req.files.length > 0) {
    const fileDocs = [];
    for (const file of req.files) {
      const uploadResult = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype, 'project-documents');
      fileDocs.push({
        project: project._id,
        name: file.originalname,
        status: "UPLOADED",
        fileUrl: uploadResult.url,
        uploadedBy: req.user._id,
        isRequired: false
      });
    }
    if (fileDocs.length > 0) {
      await ProjectDocument.insertMany(fileDocs);
    }
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

  // ── Activation Logic ─────────────────────────────────────────────────────
  // Default: create as DRAFT — the project only starts when explicitly activated
  // via POST /api/projects/:id/activate OR when skipActivation=false is passed here.
  if (activateNow) {
    // ── 1. Create Dedicated Warehouse if needed ─────────────────────────
    if (warehouseType === "DEDICATED" && !req.body.dedicatedWarehouse) {
      const newWarehouse = await Warehouse.create({
        name: `مستودع مشروع: ${name}`,
        location: `موقع المشروع: ${req.body.location || "غير محدد"}`,
        type: "PROJECT",
        project: project._id,
        manager
      });
      project.dedicatedWarehouse = newWarehouse._id;
    }

    // ── 2. Process Initial Transfers (إن وُجدت) ──────────────────────────
    const targetWarehouseId = project.dedicatedWarehouse;
    const transfersToProcess = req.body.initialTransfers || [];

    if (transfersToProcess.length > 0 && targetWarehouseId) {
      for (const transfer of transfersToProcess) {
        const { material, quantity, fromWarehouse: fromWH } = transfer;
        if (!material || !quantity || !fromWH) continue;

        const sourceInv = await Inventory.findOne({ warehouse: fromWH, material });
        if (!sourceInv || sourceInv.quantity < quantity) {
          const deficit = quantity - (sourceInv?.quantity || 0);
          await Notification.create({
            user: manager || req.user._id,
            title: "عجز في المخزون",
            body: `تعذّر نقل ${quantity} وحدة للمادة (${material}). عجز ${deficit} وحدة في المستودع المصدر.`,
            type: "WARNING",
            data: { projectId: project._id, materialId: material, deficit }
          });
          continue;
        }

        // Deduct source
        sourceInv.quantity -= quantity;
        await sourceInv.save();

        // Add to project warehouse
        await Inventory.findOneAndUpdate(
          { warehouse: targetWarehouseId, material },
          { $inc: { quantity }, $set: { lastUpdated: new Date() } },
          { upsert: true, new: true }
        );

        // Log transaction
        await MaterialTransaction.create({
          material,
          project: project._id,
          type: "TRANSFER",
          quantity,
          warehouse: targetWarehouseId,
          fromWarehouse: fromWH,
          toWarehouse: targetWarehouseId,
          processedBy: req.user._id,
          reference: `Initial transfer for project ${name}`,
          status: "COMPLETED"
        });
      }
    }

    project.status = "PLANNING";
    await project.save();

    // Open ONLY the first phase (lowest order) — enforce phase gating
    const veryFirst = await ProjectPhase.findOne({ project: project._id })
      .sort({ order: 1 });
    if (veryFirst) {
      await ProjectPhase.updateOne(
        { _id: veryFirst._id },
        { $set: { status: "IN_PROGRESS", startDate: veryFirst.startDate || new Date() } }
      );
      await ProjectPhase.updateMany(
        { project: project._id, _id: { $ne: veryFirst._id } },
        { $set: { status: "PENDING" } }
      );
    }
  } else {
    // Stay as DRAFT — just save estimatedCost
    await project.save();
  }

  return res.status(201).json({
    success: true,
    message: activateNow
      ? "Project created and activated successfully."
      : "Project draft created successfully. Use POST /projects/:id/activate to start it.",
    data: project
  });

});
export const get_projects = asynchandler(async (req, res, next) => {
  // ARCHIVED projects are excluded from the normal listing — use GET /projects/archived instead
  // ── Calculate Stats without Search Filters ─────────────────────────────────
  let baseQuery = { isActive: true, status: { $ne: "ARCHIVED" } };

  if (req.user.role !== "ADMIN" && req.user.role !== "superAdmin") {
    const assignments = await ProjectMember.find({ user: req.user._id }).select("project");
    const assignedProjectIds = assignments.map(a => a.project);

    // Also include projects where the user is assigned to a task
    const taskPhases = await ProjectPhase.find({ "tasks.assignedTo": req.user._id }).select("project");
    const taskProjectIds = taskPhases.map(ph => ph.project);
    const combinedIds = [...new Set([...assignedProjectIds, ...taskProjectIds])];

    baseQuery.$and = [{
      $or: [
        { _id: { $in: combinedIds } },
        { manager: req.user._id }
      ]
    }];
  }

  const allProjectsForStats = await ProjectModel.find(baseQuery).select("status endDate").lean();

  const stats = {
    total: allProjectsForStats.length,
    active: 0,
    planning: 0,
    completed: 0,
    onHold: 0,
    delayed: 0,
    draft: 0,
  };

  const now = new Date();
  allProjectsForStats.forEach(p => {
    let displayStatus = p.status;
    if (p.endDate && new Date(p.endDate) < now && !['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(p.status)) {
      displayStatus = "DELAYED";
    }

    if (['PLANNING', 'EXECUTION'].includes(p.status) || displayStatus === "DELAYED") stats.active++;
    if (p.status === "PLANNING") stats.planning++;
    if (p.status === "EXECUTION") stats.execution = (stats.execution || 0) + 1;
    if (p.status === "COMPLETED") stats.completed++;
    if (p.status === "ON_HOLD") stats.onHold++;
    if (displayStatus === "DELAYED") stats.delayed++;
    if (p.status === "DRAFT") stats.draft++;
    if (p.status === "CANCELLED") stats.cancelled = (stats.cancelled || 0) + 1;
  });

  // ── Search & Filter from query params ──────────────────────────────────────
  // Clone base query but when a specific status filter is applied, replace the
  // { $ne: "ARCHIVED" } with the exact status(es) requested
  let query = { isActive: true };
  // Re-apply the non-admin restriction on the data query
  if (req.user.role !== "ADMIN" && req.user.role !== "superAdmin") {
    const assignments = await ProjectMember.find({ user: req.user._id }).select("project");
    const assignedProjectIds = assignments.map(a => a.project);

    // Also include projects where the user is assigned to a task
    const taskPhases = await ProjectPhase.find({ "tasks.assignedTo": req.user._id }).select("project");
    const taskProjectIds = taskPhases.map(ph => ph.project);
    const combinedIds = [...new Set([...assignedProjectIds, ...taskProjectIds])];

    query.$and = [{
      $or: [
        { _id: { $in: combinedIds } },
        { manager: req.user._id }
      ]
    }];
  }
  const { search, status, priority, manager, type } = req.query;
  if (status) {
    const statuses = status.split(",").map(s => s.trim().toUpperCase());
    query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  } else {
    // Default: exclude ARCHIVED unless explicitly requested
    query.status = { $ne: "ARCHIVED" };
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { client: { $regex: search, $options: "i" } },
    ];
  }
  if (priority) query.priority = priority;
  if (manager) query.manager = manager;
  if (type) query.type = type;

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
    if (project.endDate && new Date(project.endDate) < now && project.status !== "COMPLETED") {
      displayStatus = "DELAYED";
    }

    return {
      ...project,
      progress,
      displayStatus
    };
  });

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

  const phasesRaw = await ProjectPhase.find({ project: req.params.id })
    .populate("tasks.assignedTo", "name email username")
    .sort({ order: 1 });
  const { assignedTo } = req.query;
  const isManager = project.manager?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "ADMIN" || req.user.role === "superAdmin";

  let filterUser = assignedTo;
  if (!isAdmin && !isManager && !assignedTo) {
    filterUser = "me";
  }

  const phases = phasesRaw.map(phase => {
    let phaseObj = phase.toObject ? phase.toObject() : phase;
    if (filterUser) {
      const resolvedUserId = filterUser === 'me' ? req.user._id.toString() : filterUser;
      phaseObj.tasks = (phaseObj.tasks || []).filter(t => 
        (t.assignedTo?._id?.toString() === resolvedUserId) || 
        (t.assignedTo?.toString() === resolvedUserId)
      );
    }
    return {
      ...phaseObj,
      statistics: calculatePhaseStatistics(phaseObj)
    };
  });

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
  let parsedBody = { ...req.body };
  ['phases', 'materials', 'equipments', 'documents', 'members', 'initialTransfers'].forEach(field => {
    if (typeof parsedBody[field] === 'string') {
      try { parsedBody[field] = JSON.parse(parsedBody[field]); } catch (e) { parsedBody[field] = []; }
    }
  });
  if (typeof parsedBody.skipActivation === 'string') parsedBody.skipActivation = parsedBody.skipActivation === 'true';
  if (typeof parsedBody.budget === 'string') parsedBody.budget = Number(parsedBody.budget);

  const project = await ProjectModel.findByIdAndUpdate(
    req.params.id,
    parsedBody,
    { new: true }
  );

  if (!project) {
    return next(new Error("Project not found", { cause: 404 }));
  }

  // Handle physically uploaded files in update
  if (req.files && req.files.length > 0) {
    const fileDocs = [];
    for (const file of req.files) {
      const uploadResult = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype, 'project-documents');
      fileDocs.push({
        project: project._id,
        name: file.originalname,
        status: "UPLOADED",
        fileUrl: uploadResult.url,
        uploadedBy: req.user._id,
        isRequired: false
      });
    }
    if (fileDocs.length > 0) {
      await ProjectDocument.insertMany(fileDocs);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Project updated successfully",
    data: project
  });
});

/**
 * SAVE DRAFT (step-by-step safe update for DRAFT projects)
 * PATCH /projects/:id/draft
 * يحفظ بيانات المسودة بأمان — مسموح فقط لو المشروع لسه DRAFT
 * أي حقل ترسله بيتحفظ بدون أن يبدأ المشروع
 */
export const save_draft = asynchandler(async (req, res, next) => {
  const { id } = req.params;

  const project = await ProjectModel.findById(id);
  if (!project) return next(new AppError("المشروع غير موجود", 404));

  if (project.status !== "DRAFT") {
    return next(new AppError("لا يمكن تعديل بيانات المسودة — المشروع بدأ بالفعل", 400));
  }

  // Fields that are not allowed to be changed via draft update
  const FORBIDDEN = ["status", "isActive", "code", "createdBy"];
  FORBIDDEN.forEach(f => delete req.body[f]);

  // Parse arrays that might come as strings (multipart/form-data)
  ['phases', 'materials', 'equipments', 'documents', 'members', 'initialTransfers'].forEach(field => {
    if (typeof req.body[field] === 'string') {
      try { req.body[field] = JSON.parse(req.body[field]); } catch (e) { delete req.body[field]; }
    }
  });
  if (typeof req.body.budget === 'string') req.body.budget = Number(req.body.budget);

  // Apply allowed field updates
  const ALLOWED_FIELDS = [
    'name', 'type', 'priority', 'budget', 'startDate', 'endDate',
    'manager', 'department', 'client', 'description', 'location',
    'warehouseType', 'dedicatedWarehouse', 'sourceWarehouse', 'initialTransfers'
  ];
  ALLOWED_FIELDS.forEach(field => {
    if (req.body[field] !== undefined) {
      project[field] = req.body[field];
    }
  });

  await project.save();

  return res.status(200).json({
    success: true,
    message: "تم حفظ المسودة بنجاح",
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

  const phasesRaw = await ProjectPhase.find({ project: id }).lean().sort({ order: 1 });
  const phases = phasesRaw.map(pObj => {
    return {
      ...pObj,
      statistics: calculatePhaseStatistics(pObj)
    };
  });

  const [members, materials, equipment, documents] = await Promise.all([
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
    firstPhase.status = "IN_PROGRESS";
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
    { status, endDate: status === "COMPLETED" ? new Date() : undefined },
    { new: true }
  );

  if (!phase) {
    return next(new AppError("Phase not found.", 404));
  }

  if (status === "COMPLETED") {
    // Open next phase
    const nextPhase = await ProjectPhase.findOne({
      project: projectId,
      order: { $gt: phase.order },
      status: { $in: ["PENDING", "IN_PROGRESS"] }
    }).sort({ order: 1 });

    if (nextPhase && nextPhase.status === "PENDING") {
      nextPhase.status = "IN_PROGRESS";
      nextPhase.startDate = nextPhase.startDate || new Date();
      await nextPhase.save();
    }

    // Check if project is completed
    const remainingPhases = await ProjectPhase.countDocuments({
      project: projectId,
      status: { $ne: "COMPLETED" }
    });
    if (remainingPhases === 0) {
      await ProjectModel.findByIdAndUpdate(projectId, {
        status: "COMPLETED",
        completionDate: new Date()
      });
    }
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
  const { assignedTo } = req.query;

  const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId })
    .populate('requiredApprovals.user', 'name')
    .populate('requiredAttachments.attachmentId', 'url name')
    .populate('tasks.assignedTo', 'name email username')
    .lean();

  if (!phase) return next(new AppError('Phase not found.', 404));

  const project = await ProjectModel.findById(projectId).select("manager").lean();
  const isManager = project?.manager?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "ADMIN" || req.user.role === "superAdmin";

  let filterUser = assignedTo;
  if (!isAdmin && !isManager && !assignedTo) {
    filterUser = "me";
  }

  let filteredPhase = { ...phase };
  if (filterUser) {
    const resolvedUserId = filterUser === 'me' ? req.user._id.toString() : filterUser;
    filteredPhase.tasks = (filteredPhase.tasks || []).filter(t => 
      (t.assignedTo?._id?.toString() === resolvedUserId) || 
      (t.assignedTo?.toString() === resolvedUserId)
    );
  }

  return res.status(200).json({
    success: true,
    data: {
      ...filteredPhase,
      statistics: calculatePhaseStatistics(filteredPhase)
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
  phase.status = "COMPLETED";
  phase.endDate = phase.endDate || new Date();
  await phase.save();

  // 🔔 Broadcast phase completion to all connected clients
  emitToProject(projectId, 'phase:updated', {
    type: 'UPDATED',
    phaseId: phase._id,
    phaseName: phase.name,
    projectId,
    status: 'COMPLETED',
    prevStatus: 'IN_PROGRESS',
    timestamp: new Date().toISOString(),
  });

  emitToProject(projectId, 'notification:phase_completed', {
    phaseId: phase._id,
    phaseName: phase.name,
    projectId,
    completedAt: new Date().toISOString(),
  });

  // ── فتح المرحلة التالية تلقائياً ─────────────────────────────────────
  // Use $gt to handle non-consecutive order numbers (0,2,4 or 1,3,5 etc.)
  const nextPhase = await ProjectPhase.findOne({
    project: projectId,
    order: { $gt: phase.order },
    status: { $in: ["PENDING", "IN_PROGRESS"] }
  }).sort({ order: 1 });

  let nextPhaseData = null;
  if (nextPhase && nextPhase.status === "PENDING") {
    nextPhase.status = "IN_PROGRESS";
    nextPhase.startDate = nextPhase.startDate || new Date();
    await nextPhase.save();
    nextPhaseData = { _id: nextPhase._id, name: nextPhase.nameAr || nextPhase.name, order: nextPhase.order };

    // 🔔 Broadcast next phase activation
    emitToProject(projectId, 'phase:updated', {
      type: 'UPDATED',
      phaseId: nextPhase._id,
      phaseName: nextPhase.name,
      projectId,
      status: 'IN_PROGRESS',
      prevStatus: 'PENDING',
      timestamp: new Date().toISOString(),
    });
  } else if (nextPhase) {
    nextPhaseData = { _id: nextPhase._id, name: nextPhase.nameAr || nextPhase.name, order: nextPhase.order };
  }

  // ── هل اكتملت كل المراحل؟ ────────────────────────────────────────────
  const remainingPhases = await ProjectPhase.countDocuments({
    project: projectId,
    status: { $ne: "COMPLETED" }
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

  // 📊 Dashboard update
  emitDashboardUpdate({ trigger: 'phase_completed', projectId, phaseId: phase._id });

  return res.status(200).json({
    success: true,
    message: nextPhaseData
      ? `تم إكمال المرحلة وفتح المرحلة التالية: ${nextPhaseData.name}`
      : "تم إكمال آخر مرحلة في المشروع",
    data: {
      completedPhase: { _id: phase._id, name: phase.nameAr || phase.name, status: phase.status },
      nextPhase: nextPhaseData,
      projectCompleted: remainingPhases === 0
    }
  });
});

/**
 * UPDATE TASK STATUS / ASSIGNEE
 * PATCH /projects/:id/phases/:phaseId/tasks/:taskId
 * Body: { status?, assignedTo?, notes? }
 */
export const updateTask = asynchandler(async (req, res, next) => {
  const { id: projectId, phaseId, taskId } = req.params;
  const { status, assignedTo, notes, priority } = req.body;

  const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  if (status && !VALID_STATUSES.includes(status)) {
    return next(new AppError(`حالة غير صالحة. القيم المتاحة: ${VALID_STATUSES.join(", ")}`, 400));
  }

  const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
  if (!phase) return next(new AppError("المرحلة غير موجودة", 404));

  const task = phase.tasks.id(taskId);
  if (!task) return next(new AppError("المهمة غير موجودة", 404));

  const prevAssignee = task.assignedTo?.toString();

  if (status) task.status = status;
  if (status === "COMPLETED") task.completedAt = new Date();
  if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
  if (notes !== undefined) task.description = notes;
  if (priority) task.priority = priority;

  await phase.save();

  // 🔔 Notify new assignee if changed
  if (assignedTo && assignedTo !== prevAssignee) {
    const project = await ProjectModel.findById(projectId).lean();
    await createNotification(
      assignedTo,
      `📋 تم تعيينك على مهمة`,
      `تم تعيينك على مهمة "${task.name}" في مرحلة "${phase.nameAr || phase.name}" بمشروع "${project?.name}".`,
      "INFO",
      { projectId, phaseId, taskId }
    ).catch(() => { });
  }

  return res.status(200).json({
    success: true,
    message: "تم تحديث المهمة بنجاح",
    data: task
  });
});

/**
 * REVIEW ATTACHMENT (manager approve / reject)
 * PATCH /projects/:id/phases/:phaseId/attachments/:slotId/review
 * Body: { reviewStatus: "APPROVED"|"REJECTED", rejectionReason? }
 */
export const reviewAttachment = asynchandler(async (req, res, next) => {
  const { id: projectId, phaseId, slotId } = req.params;
  const { reviewStatus, rejectionReason } = req.body;

  if (!["APPROVED", "REJECTED"].includes(reviewStatus)) {
    return next(new AppError("reviewStatus يجب أن يكون APPROVED أو REJECTED", 400));
  }

  const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
  if (!phase) return next(new AppError("المرحلة غير موجودة", 404));

  const slot = phase.requiredAttachments.id(slotId);
  if (!slot) return next(new AppError("المرفق غير موجود", 404));

  if (!slot.attachmentId) {
    return next(new AppError("لا يمكن مراجعة مرفق لم يُرفع بعد", 400));
  }

  slot.reviewStatus = reviewStatus;
  if (rejectionReason) slot.rejectionReason = rejectionReason;

  await phase.save();

  return res.status(200).json({
    success: true,
    message: reviewStatus === "APPROVED" ? "تمت الموافقة على المرفق" : "تم رفض المرفق",
    data: slot
  });
});

/**
 * APPROVE / REJECT PHASE APPROVAL SLOT (inline requiredApprovals[])
 * PATCH /projects/:id/phases/:phaseId/approvals/:slotId
 * Body: { status: "APPROVED"|"REJECTED", notes? }
 */
export const approvePhaseSlot = asynchandler(async (req, res, next) => {
  const { id: projectId, phaseId, slotId } = req.params;
  const { status, notes } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return next(new AppError("status يجب أن يكون APPROVED أو REJECTED", 400));
  }

  const phase = await ProjectPhase.findOne({ _id: phaseId, project: projectId });
  if (!phase) return next(new AppError("المرحلة غير موجودة", 404));

  const slot = phase.requiredApprovals.id(slotId);
  if (!slot) return next(new AppError("طلب الموافقة غير موجود", 404));

  slot.status = status;
  slot.user = req.user._id;
  slot.actionDate = new Date();
  if (notes) slot.notes = notes;

  await phase.save();

  // 🔔 Notify project manager of the decision
  const project = await ProjectModel.findById(projectId).lean();
  if (project?.manager) {
    await createNotification(
      project.manager,
      status === "APPROVED" ? "✅ موافقة جديدة على مرحلة" : "❌ رفض موافقة على مرحلة",
      `${status === "APPROVED" ? "تمت الموافقة" : "تم الرفض"} على طلب الموافقة في مرحلة "${phase.nameAr || phase.name}" بمشروع "${project.name}".`,
      status === "APPROVED" ? "SUCCESS" : "WARNING",
      { projectId, phaseId, slotId, type: "PHASE_APPROVAL" }
    ).catch(() => { });
  }

  return res.status(200).json({
    success: true,
    message: status === "APPROVED" ? "تمت الموافقة بنجاح" : "تم الرفض بنجاح",
    data: slot
  });
});

/**
 * GET ALL PROJECT TASKS
 * GET /projects/:id/tasks
 * Query: ?assignedTo=userId (or 'me') & status=PENDING,IN_PROGRESS,COMPLETED,CANCELLED & priority=LOW,MEDIUM,HIGH
 */
export const get_project_tasks = asynchandler(async (req, res, next) => {
  const { id } = req.params;
  const { assignedTo, status, priority } = req.query;

  const project = await ProjectModel.findById(id);
  if (!project) {
    return next(new AppError("المشروع غير موجود", 404));
  }

  // Restrict access for non-admins
  const isManager = project.manager?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "ADMIN" || req.user.role === "superAdmin";

  if (!isAdmin) {
    const isMember = await ProjectMember.exists({ project: id, user: req.user._id });
    const hasAssignedTask = await ProjectPhase.exists({ project: id, "tasks.assignedTo": req.user._id });

    if (!isManager && !isMember && !hasAssignedTask) {
      return next(new AppError("غير مصرح لك بمشاهدة مهام هذا المشروع", 403));
    }
  }

  const phases = await ProjectPhase.find({ project: id })
    .populate("tasks.assignedTo", "name email username")
    .lean();

  let allTasks = [];
  phases.forEach(phase => {
    if (phase.tasks && phase.tasks.length > 0) {
      phase.tasks.forEach(task => {
        allTasks.push({
          ...task,
          phaseId: phase._id,
          phaseName: phase.name,
          phaseNameAr: phase.nameAr,
          phaseNameEn: phase.nameEn,
          phaseStatus: phase.status,
          projectId: id,
          projectName: project.name
        });
      });
    }
  });

  let filterUser = assignedTo;
  if (!isAdmin && !isManager && !assignedTo) {
    filterUser = "me";
  }

  if (filterUser === "me") {
    filterUser = req.user._id.toString();
  }

  if (filterUser) {
    allTasks = allTasks.filter(t => 
      (t.assignedTo?._id?.toString() === filterUser.toString()) || 
      (t.assignedTo?.toString() === filterUser.toString())
    );
  }

  if (status) {
    const statuses = status.split(",").map(s => s.trim().toUpperCase());
    allTasks = allTasks.filter(t => statuses.includes(t.status?.toUpperCase()));
  }

  if (priority) {
    const priorities = priority.split(",").map(p => p.trim().toUpperCase());
    allTasks = allTasks.filter(t => priorities.includes(t.priority?.toUpperCase()));
  }

  // Sort by createdAt descending
  allTasks.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));

  return res.status(200).json({
    success: true,
    data: allTasks
  });
});

