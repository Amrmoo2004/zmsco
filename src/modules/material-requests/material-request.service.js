import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import Material from "../../db/models/metrials/metrials.js";
import Project from "../../db/models/projects/project.js";
import Inventory from "../../db/models/inventory.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import ProjectMaterial from "../../db/models/metrials/projectMaterial.model.js";
import mongoose from "mongoose";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitToManagers, emitInventoryUpdate } from "../../utils/socket.js";
import User from "../../db/models/user.js";
import ApprovalRule from "../../db/models/settings/approvalRule.model.js";
import { getActiveConfig } from "../inventory-settings/inventorySettings.service.js";

// ─── Helper: populate a request fully ────────────────────────────────────────
const populateRequest = (query) =>
  query
    .populate("project", "name warehouseType dedicatedWarehouse manager")
    .populate("phase", "name nameAr order")
    .populate("warehouse", "name type")
    .populate("materials.material", "name unit standardCost alertQuantity")
    .populate("requestedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("issuedBy", "name email");

// ─── Helper: enrich materials with live availability ─────────────────────────
const enrichMaterials = async (materials, warehouseId) => {
  const matIds = materials.map((m) =>
    m.material?._id ? m.material._id : m.material
  );

  const matchStage = { material: { $in: matIds } };
  if (warehouseId) matchStage.warehouse = new mongoose.Types.ObjectId(String(warehouseId));

  const balances = await Inventory.aggregate([
    { $match: matchStage },
    { $group: { _id: "$material", availableQuantity: { $sum: "$quantity" } } }
  ]);

  const balanceMap = {};
  balances.forEach((b) => { balanceMap[String(b._id)] = b.availableQuantity; });

  return materials.map((item) => {
    const matId = String(item.material?._id || item.material);
    const availableQuantity = balanceMap[matId] ?? 0;
    return {
      ...item.toObject ? item.toObject() : item,
      availableQuantity,
      isAvailable: availableQuantity >= item.quantity,
      availabilityStatus: availableQuantity >= item.quantity ? "AVAILABLE" : "INSUFFICIENT"
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
/** GET /material-requests — list with filters */
export const getAllRequests = asynchandler(async (req, res) => {
  const { status, project, phase, warehouse, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status)    query.status    = status;
  if (project)   query.project   = project;
  if (phase)     query.phase     = phase;
  if (warehouse) query.warehouse = warehouse;

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    populateRequest(MaterialRequest.find(query))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    MaterialRequest.countDocuments(query)
  ]);

  return res.status(200).json({
    success: true,
    data: requests,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/** GET /material-requests/:id — single request with live availability */
export const getRequestById = asynchandler(async (req, res, next) => {
  const request = await populateRequest(MaterialRequest.findById(req.params.id));
  if (!request) return next(new AppError("Material request not found", 404));

  // Enrich each material with live availability from the source warehouse
  const enrichedMaterials = await enrichMaterials(
    request.materials,
    request.warehouse?._id ?? request.warehouse
  );

  return res.status(200).json({
    success: true,
    data: { ...request.toObject(), materials: enrichedMaterials }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /material-requests — إنشاء طلب صرف مواد
 * Body: { project, warehouse, phase?, materials: [{ material, quantity }], notes? }
 * Step 1 اختيار المستودع → Step 2 اختيار المواد → Step 3 مراجعة وإرسال
 */
export const createRequest = asynchandler(async (req, res, next) => {
  const { project, warehouse, phase, materials, notes } = req.body;

  // ── Validate project ────────────────────────────────────────────────────
  const projectExists = await Project.findById(project);
  if (!projectExists) return next(new AppError("Project not found", 404));

  // ── Validate warehouse exists ───────────────────────────────────────────
  const Warehouse = mongoose.model("Warehouse");
  const warehouseExists = await Warehouse.findById(warehouse);
  if (!warehouseExists) return next(new AppError("Warehouse not found", 404));

  // ── Validate materials + compute costs ─────────────────────────────────
  if (!materials || materials.length === 0)
    return next(new AppError("At least one material is required", 400));

  const enrichedItems = [];
  let totalRequestCost = 0;

  for (const item of materials) {
    const mat = await Material.findById(item.material).populate("unit");
    if (!mat) return next(new AppError(`Material ID ${item.material} not found`, 404));
    if (!item.quantity || item.quantity <= 0)
      return next(new AppError(`Quantity for ${mat.name} must be greater than 0`, 400));

    const unitCost  = mat.standardCost || 0;
    const totalCost = unitCost * item.quantity;
    totalRequestCost += totalCost;

    enrichedItems.push({
      material:  mat._id,
      quantity:  item.quantity,
      unitCost,
      totalCost
    });
  }

  // ── Determine workflow / initial status ────────────────────────────────
  const approvalRule = await ApprovalRule.findOne({
    entityType: "مخزون",
    isActive: true
  }).populate("workflow");

  let assignedWorkflow = null;
  let initialStatus    = "PENDING";

  if (
    approvalRule?.workflow?.isActive &&
    approvalRule.workflow.steps?.length > 0
  ) {
    // إذا كان يوجد Workflow → استخدمه
    assignedWorkflow = approvalRule.workflow._id;
    initialStatus    = "PENDING_APPROVAL";
  } else {
    // Fallback: إذا كان إعداد "الموافقة على الصرف" مفعّلاً من صفحة الإعدادات
    const invConfig = await getActiveConfig();
    if (invConfig.requireIssuanceApproval) {
      initialStatus = "PENDING_APPROVAL";
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────
  const request = await MaterialRequest.create({
    project,
    warehouse,
    phase:            phase || undefined,
    materials:        enrichedItems,
    totalRequestCost,
    notes,
    requestedBy:      req.user._id,
    status:           initialStatus,
    workflow:         assignedWorkflow,
    currentStepIndex: 0,
    approvalHistory:  []
  });

  await populateRequest(MaterialRequest.findById(request._id)).then((r) =>
    Object.assign(request, r?.toObject() || {})
  );

  // ── Notify managers ─────────────────────────────────────────────────────
  emitToManagers("notification:approval_pending", {
    requestId:      request._id,
    requestNumber:  request.requestNumber,
    projectName:    projectExists.name,
    requestedBy:    req.user._id,
    materialsCount: enrichedItems.length,
    totalCost:      totalRequestCost,
    createdAt:      new Date().toISOString()
  });

  // Notify project manager specifically
  if (projectExists.manager) {
    await createNotification(
      projectExists.manager,
      "📋 طلب صرف مواد جديد",
      `تم إنشاء طلب صرف مواد جديد (${request.requestNumber}) في مشروع "${projectExists.name}" بتكلفة ${totalRequestCost} ريال.`,
      "INFO",
      { requestId: request._id, projectId: project }
    );
  }

  return res.status(201).json({
    success: true,
    message: "Material request created successfully",
    data:    request
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/** PUT /material-requests/:id — تعديل الطلب (فقط لو PENDING) */
export const updateRequest = asynchandler(async (req, res, next) => {
  const { id } = req.params;
  const { materials, notes, warehouse, phase } = req.body;

  const request = await MaterialRequest.findById(id);
  if (!request) return next(new AppError("Material request not found", 404));
  if (!["PENDING", "PENDING_APPROVAL"].includes(request.status))
    return next(new AppError("Cannot update a request that has already been processed", 400));

  if (materials && materials.length > 0) {
    let totalRequestCost = 0;
    const enrichedItems  = [];

    for (const item of materials) {
      const mat = await Material.findById(item.material);
      if (!mat) return next(new AppError(`Material ID ${item.material} not found`, 404));

      const unitCost  = item.unitCost ?? mat.standardCost ?? 0;
      const totalCost = unitCost * item.quantity;
      totalRequestCost += totalCost;

      enrichedItems.push({ material: mat._id, quantity: item.quantity, unitCost, totalCost });
    }

    request.materials        = enrichedItems;
    request.totalRequestCost = totalRequestCost;
  }

  if (notes     !== undefined) request.notes     = notes;
  if (warehouse !== undefined) request.warehouse  = warehouse;
  if (phase     !== undefined) request.phase      = phase;

  await request.save();
  const populated = await populateRequest(MaterialRequest.findById(id));

  return res.status(200).json({
    success: true,
    message: "Material request updated successfully",
    data:    populated
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/** DELETE /material-requests/:id */
export const deleteRequest = asynchandler(async (req, res, next) => {
  const request = await MaterialRequest.findById(req.params.id);
  if (!request) return next(new AppError("Material request not found", 404));
  if (!["PENDING", "PENDING_APPROVAL"].includes(request.status))
    return next(new AppError("Cannot delete a request that has already been processed", 400));

  await request.deleteOne();
  return res.status(200).json({ success: true, message: "Material request deleted successfully" });
});

// ─────────────────────────────────────────────────────────────────────────────
/** PATCH /material-requests/:id/approve — الموافقة على الطلب */
export const approveRequest = asynchandler(async (req, res, next) => {
  const { comments } = req.body;

  const request = await populateRequest(
    MaterialRequest.findById(req.params.id).populate({
      path:     "workflow",
      populate: { path: "steps.role", select: "_id name" }
    })
  );
  if (!request) return next(new AppError("Material request not found", 404));

  // ── No workflow — direct approval ───────────────────────────────────────
  if (request.status === "PENDING") {
    // ── Authorization: only ADMIN or the project's manager can approve ──
    const projectDoc = await Project.findById(request.project?._id || request.project).lean();
    const isAdmin    = ["ADMIN", "superAdmin"].includes(req.user.role);
    const isManager  = projectDoc?.manager && String(projectDoc.manager) === String(req.user._id);

    if (!isAdmin && !isManager) {
      return next(new AppError("غير مصرح لك — فقط الـ Admin أو مدير المشروع يمكنهم الموافقة على هذا الطلب", 403));
    }

    request.status     = "APPROVED";
    request.approvedBy = req.user._id;
    await request.save();

    // Notify requester
    await createNotification(
      request.requestedBy._id,
      "✅ طلب المواد تم قبوله",
      `تم قبول طلب صرف المواد (${request.requestNumber}) في مشروع "${request.project?.name}".`,
      "SUCCESS",
      { requestId: request._id, projectId: request.project?._id }
    );
    emitToProject(String(request.project?._id), "approval:approved", {
      requestId:  request._id,
      projectId:  request.project?._id,
      approvedBy: req.user._id,
      timestamp:  new Date().toISOString()
    });

    return res.status(200).json({ success: true, message: "Material request approved", data: request });
  }

  if (request.status !== "PENDING_APPROVAL")
    return next(new AppError(`Cannot approve request with status: ${request.status}`, 400));

  // ── Workflow step validation ─────────────────────────────────────────────
  const workflow    = request.workflow;
  if (!workflow?.steps?.length)
    return next(new AppError("Workflow not configured properly", 500));

  const stepIndex  = request.currentStepIndex ?? 0;
  const step       = workflow.steps[stepIndex];
  if (!step) return next(new AppError("Invalid workflow step", 500));

  let authorized = false;
  if (step.user && String(step.user) === String(req.user._id)) {
    authorized = true;
  } else if (step.role) {
    const userRoleId = String(req.user.role?._id || req.user.role);
    const stepRoleId = String(step.role?._id || step.role);
    if (userRoleId === stepRoleId) authorized = true;
  }

  if (!authorized)
    return next(new AppError("You are not authorized to approve this step", 403));

  // Record approval
  request.approvalHistory.push({
    stepIndex,
    role:       step.role?._id ?? step.role,
    user:       step.user,
    approvedBy: req.user._id,
    status:     "APPROVED",
    comment:    comments || "",
    timestamp:  new Date()
  });

  if (stepIndex === workflow.steps.length - 1) {
    // All steps done → fully approved
    request.status     = "APPROVED";
    request.approvedBy = req.user._id;
    await request.save();

    await createNotification(
      request.requestedBy._id,
      "✅ طلب المواد اعتُمد بالكامل",
      `تم اكتمال اعتماد طلب صرف المواد (${request.requestNumber}) في مشروع "${request.project?.name}".`,
      "SUCCESS",
      { requestId: request._id, projectId: request.project?._id }
    );
    emitToProject(String(request.project?._id), "approval:approved", {
      requestId: request._id, approvedBy: req.user._id, timestamp: new Date().toISOString()
    });

    return res.status(200).json({ success: true, message: "Workflow complete — request fully approved", data: request });
  }

  // Move to next step
  request.currentStepIndex += 1;
  await request.save();

  return res.status(200).json({
    success: true,
    message: `Step ${stepIndex + 1} approved — moved to next approver`,
    data:    request
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/** PATCH /material-requests/:id/reject — رفض الطلب */
export const rejectRequest = asynchandler(async (req, res, next) => {
  const { reason } = req.body;

  const request = await populateRequest(
    MaterialRequest.findById(req.params.id).populate({
      path:     "workflow",
      populate: { path: "steps.role", select: "_id name" }
    })
  );
  if (!request) return next(new AppError("Material request not found", 404));
  if (!["PENDING", "PENDING_APPROVAL"].includes(request.status))
    return next(new AppError(`Cannot reject request with status: ${request.status}`, 400));

  // ── For PENDING (no workflow): only ADMIN or project manager can reject ──
  if (request.status === "PENDING") {
    const projectDoc = await Project.findById(request.project?._id || request.project).lean();
    const isAdmin    = ["ADMIN", "superAdmin"].includes(req.user.role);
    const isManager  = projectDoc?.manager && String(projectDoc.manager) === String(req.user._id);
    if (!isAdmin && !isManager) {
      return next(new AppError("غير مصرح لك — فقط الـ Admin أو مدير المشروع يمكنهم رفض هذا الطلب", 403));
    }
  }

  if (request.status === "PENDING_APPROVAL") {
    // Workflow step auth check
    const workflow = request.workflow;
    if (!workflow?.steps?.length)
      return next(new AppError("Workflow not configured", 500));

    const stepIndex = request.currentStepIndex ?? 0;
    const step      = workflow.steps[stepIndex];
    if (!step) return next(new AppError("Invalid workflow step", 500));

    let authorized = false;
    if (step.user && String(step.user) === String(req.user._id)) authorized = true;
    else if (step.role) {
      const userRoleId = String(req.user.role?._id || req.user.role);
      const stepRoleId = String(step.role?._id || step.role);
      if (userRoleId === stepRoleId) authorized = true;
    }

    if (!authorized)
      return next(new AppError("You are not authorized to reject this step", 403));

    request.approvalHistory.push({
      stepIndex,
      role:       step.role?._id ?? step.role,
      user:       step.user,
      approvedBy: req.user._id,
      status:     "REJECTED",
      comment:    reason || "",
      timestamp:  new Date()
    });
  }

  request.status          = "REJECTED";
  request.rejectionReason = reason || "";
  await request.save();

  await createNotification(
    request.requestedBy._id,
    "❌ طلب المواد تم رفضه",
    `تم رفض طلب صرف المواد (${request.requestNumber}) في مشروع "${request.project?.name}".${reason ? " السبب: " + reason : ""}`,
    "ERROR",
    { requestId: request._id, projectId: request.project?._id }
  );
  emitToProject(String(request.project?._id), "approval:rejected", {
    requestId: request._id, reason, rejectedBy: req.user._id, timestamp: new Date().toISOString()
  });

  return res.status(200).json({ success: true, message: "Material request rejected", data: request });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /material-requests/:id/fulfill — الموافقة والصرف
 * يُخصم المواد من المستودع المُختار في الطلب، ثم يُسجّل Transaction.
 */
export const fulfillRequest = asynchandler(async (req, res, next) => {
  const request = await populateRequest(MaterialRequest.findById(req.params.id));
  if (!request) return next(new AppError("Material request not found", 404));
  if (request.status !== "APPROVED")
    return next(new AppError("Only approved requests can be fulfilled", 400));

  const project   = request.project;
  const sourceWh  = request.warehouse;   // المستودع المختار في Step 1

  for (const item of request.materials) {
    const matId    = item.material._id;
    const matName  = item.material.name;
    const qty      = item.quantity;

    // ── تحقق من وجود مخزون كافٍ ────────────────────────────────────────
    const stock = await Inventory.findOne({
      material: matId,
      warehouse: sourceWh._id ?? sourceWh,
      quantity:  { $gte: qty }
    });

    if (!stock) {
      return next(
        new AppError(
          `مخزون غير كافٍ من "${matName}" في المستودع "${sourceWh?.name ?? sourceWh}". المطلوب: ${qty}`,
          400
        )
      );
    }

    // ── خصم من المستودع ──────────────────────────────────────────────────
    stock.quantity    -= qty;
    stock.lastUpdated  = new Date();
    await stock.save();

    // ── تسجيل transaction ────────────────────────────────────────────────
    await MaterialTransaction.create({
      project:          project._id,
      material:         matId,
      quantity:         qty,
      type:             "ISSUE",
      warehouse:        sourceWh._id ?? sourceWh,
      referenceRequest: request._id,
      createdBy:        req.user._id
    });

    // ── تحديث ProjectMaterial ─────────────────────────────────────────────
    await ProjectMaterial.findOneAndUpdate(
      { project: project._id, material: matId },
      {
        $inc: { issuedQuantity: qty },
        $setOnInsert: { unitCost: item.unitCost, plannedQuantity: qty }
      },
      { upsert: true }
    );

    // ── إشعار live inventory update ───────────────────────────────────────
    emitInventoryUpdate({
      materialId:   String(matId),
      materialName: matName,
      newQuantity:  stock.quantity,
      deducted:     qty,
      projectId:    String(project._id),
      timestamp:    new Date().toISOString()
    });

    // ── تنبيه مخزون منخفض ────────────────────────────────────────────────
    const minStock = item.material.alertQuantity || 0;
    if (stock.quantity <= minStock && minStock > 0) {
      emitToManagers("inventory:low_stock", {
        materialId:      String(matId),
        materialName:    matName,
        currentQuantity: stock.quantity,
        minStock,
        timestamp:       new Date().toISOString()
      });

      const Role = (await import("../../db/models/roles.js")).default;
      const mgmtRoles = await Role.find({ 
        name: { $in: ["manager", "admin", "ADMIN", "superAdmin", "Manager", "Admin"] } 
      }).select("_id").lean();
      const mgmtRoleIds = mgmtRoles.map(r => r._id);

      const managers = await User.find({ role: { $in: mgmtRoleIds } });
      await Promise.all(
        managers.map((m) =>
          createNotification(
            m._id,
            `📉 مخزون منخفض: ${matName}`,
            `الكمية المتبقية من "${matName}" (${stock.quantity}) أقل من الحد الأدنى (${minStock}).`,
            "WARNING",
            { materialId: matId, currentQuantity: stock.quantity, minStock, projectId: project._id }
          ).catch(() => {})
        )
      );
    }
  }

  // ── تحديث الطلب ────────────────────────────────────────────────────────
  request.status   = "FULFILLED";
  request.issuedBy = req.user._id;
  await request.save();

  await createNotification(
    request.requestedBy._id,
    "📦 تم صرف المواد",
    `تم صرف المواد لمشروع "${project?.name}" بنجاح (${request.requestNumber}).`,
    "SUCCESS",
    { requestId: request._id, projectId: project?._id }
  );

  return res.status(200).json({
    success: true,
    message: "Material request fulfilled successfully",
    data:    request
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /material-requests/projects/:projectId/tracking
 * شاشة "تتبع استهلاك المواد" — كل مادة في المشروع مع:
 *   - plannedQty (الاستهلاك المخطط)
 *   - approvedQty (تم اعتمادها في طلبات)
 *   - issuedQty  (تم الصرف الفعلي)
 *   - remainingBudget
 *   - consumptionRate %
 */
export const getProjectMaterialTracking = asynchandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { phase } = req.query;

  const project = await Project.findById(projectId);
  if (!project) return next(new AppError("Project not found", 404));

  // كل ProjectMaterials المرتبطة بالمشروع (المخططة)
  const projectMaterials = await ProjectMaterial.find({ project: projectId })
    .populate("material", "name unit standardCost alertQuantity category")
    .lean();

  const matchConditionApproved = {
    project: new mongoose.Types.ObjectId(projectId),
    status: { $in: ["APPROVED", "FULFILLED"] }
  };
  const matchConditionIssued = {
    project: new mongoose.Types.ObjectId(projectId),
    status: "FULFILLED"
  };

  if (phase) {
    matchConditionApproved.phase = new mongoose.Types.ObjectId(phase);
    matchConditionIssued.phase = new mongoose.Types.ObjectId(phase);
  }

  // جمع الكميات من الطلبات المعتمدة/المنجزة
  const approvedAgg = await MaterialRequest.aggregate([
    { $match: matchConditionApproved },
    { $unwind: "$materials" },
    {
      $group: {
        _id: "$materials.material",
        approvedQty: { $sum: "$materials.quantity" },
        approvedCost: { $sum: "$materials.totalCost" }
      }
    }
  ]);

  // جمع الكميات المصروفة فعلياً من الطلبات FULFILLED
  const issuedAgg = await MaterialRequest.aggregate([
    { $match: matchConditionIssued },
    { $unwind: "$materials" },
    {
      $group: {
        _id: "$materials.material",
        issuedQty: { $sum: "$materials.quantity" },
        issuedCost: { $sum: "$materials.totalCost" }
      }
    }
  ]);

  // تجميع كل الـ Materials الفريدة (المخططة + المعتمدة + المصروفة)
  const allMaterialIds = new Set();
  projectMaterials.forEach(pm => allMaterialIds.add(String(pm.material?._id || pm.material)));
  approvedAgg.forEach(a => allMaterialIds.add(String(a._id)));
  issuedAgg.forEach(i => allMaterialIds.add(String(i._id)));

  const uniqueMatIds = Array.from(allMaterialIds);

  // جلب تفاصيل المواد اللي ممكن تكون اتصرفت بس مش موجودة في الـ ProjectMaterials (غير مخططة)
  const materialDetails = await mongoose.model("Material").find({ _id: { $in: uniqueMatIds } }).lean();
  const matDict = {};
  materialDetails.forEach(m => { matDict[String(m._id)] = m; });

  const pmDict = {};
  projectMaterials.forEach(pm => { pmDict[String(pm.material?._id || pm.material)] = pm; });

  const approvedMap = {};
  approvedAgg.forEach((a) => { approvedMap[String(a._id)] = a; });

  const issuedMap = {};
  issuedAgg.forEach((i) => { issuedMap[String(i._id)] = i; });

  // بناء بيانات كل مادة
  const trackingData = uniqueMatIds.map((matId) => {
    const pm = pmDict[matId];
    const matInfo = pm?.material || matDict[matId];
    
    const approvedRec = approvedMap[matId] || { approvedQty: 0, approvedCost: 0 };
    const issuedRec = issuedMap[matId] || { issuedQty: 0, issuedCost: 0 };

    // إذا كنا نبحث عن مرحلة معينة، الـ planned تعتبر 0 لهذه المرحلة لأنها تُعرف للمشروع ككل فقط
    const plannedQty = phase ? 0 : (pm?.plannedQuantity || 0);
    const approvedQty = approvedRec.approvedQty;
    const issuedQty = issuedRec.issuedQty;
    
    const unitCost = pm?.unitCost || matInfo?.standardCost || 0;

    const plannedCost = phase ? 0 : (plannedQty * unitCost);
    const approvedCost = approvedRec.approvedCost;
    const issuedCost = issuedRec.issuedCost;

    // نسبة الصرف من المسموح (issued / approved)
    const consumptionRate = approvedQty > 0
      ? Math.min(Math.round((issuedQty / approvedQty) * 100), 100)
      : 0;

    // نسبة الصرف من الطلبية (issued / planned)
    const planRate = plannedQty > 0
      ? Math.min(Math.round((issuedQty / plannedQty) * 100), 100)
      : 0;

    return {
      material: matInfo,
      unitCost,
      plannedQty,
      approvedQty,
      issuedQty,
      remainingQty: Math.max(approvedQty - issuedQty, 0),
      plannedCost,
      approvedCost,
      issuedCost,
      consumptionRate,
      planRate,
      status:
        issuedQty >= approvedQty && approvedQty > 0
          ? "FULLY_CONSUMED"
          : issuedQty > 0
          ? "PARTIALLY_CONSUMED"
          : "NOT_STARTED"
    };
  });

  // إجمالي المشروع أو المرحلة
  const totalPlannedCost = trackingData.reduce((s, m) => s + m.plannedCost, 0);
  const totalApprovedCost = trackingData.reduce((s, m) => s + m.approvedCost, 0);
  const totalIssuedCost = trackingData.reduce((s, m) => s + m.issuedCost, 0);
  
  const overallRate = totalApprovedCost > 0
    ? Math.round((totalIssuedCost / totalApprovedCost) * 100)
    : 0;

  return res.status(200).json({
    success: true,
    data: {
      project: {
        _id: project._id,
        name: project.name,
        totalPlannedCost,
        totalApprovedCost,
        totalIssuedCost,
        remainingBudget: totalApprovedCost - totalIssuedCost,
        overallRate
      },
      materials: trackingData
    }
  });
});
