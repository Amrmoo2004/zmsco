import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import Material from "../../db/models/metrials/metrials.js";
import Project from "../../db/models/projects/project.js";
import Inventory from "../../db/models/inventory.js";
import MaterialTransaction from "../../db/models/metrials/materialTransaction.model.js";
import ProjectMaterial from "../../db/models/metrials/📁 projectMaterial.model.js";
import mongoose from "mongoose";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitToManagers, emitInventoryUpdate } from "../../utils/socket.js";
import User from "../../db/models/user.js";
import ApprovalRule from "../../db/models/settings/approvalRule.model.js";
import Workflow from "../../db/models/settings/workflow.model.js";
/** Get all material requests with filters */
export const getAllRequests = asynchandler(async (req, res, next) => {
    const { status, project } = req.query;
    const query = {};
    if (status) query.status = status;
    if (project) query.project = project;

    const requests = await MaterialRequest.find(query)
        .populate("project", "name")
        .populate("materials.material", "name unit")
        .populate("requestedBy", "name email")
        .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: requests });
});

/** Get request by ID */
export const getRequestById = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id)
        .populate("project", "name")
        .populate("materials.material", "name unit")
        .populate("requestedBy", "name email");

    if (!request) return next(new AppError("Material request not found", 404));
    return res.status(200).json({ success: true, data: request });
});

/** Create material request — notifies managers for approval */
export const createRequest = asynchandler(async (req, res, next) => {
    const { project, materials, notes } = req.body;

    const projectExists = await Project.findById(project);
    if (!projectExists) return next(new AppError("Project not found", 404));

    for (const item of materials) {
        const materialExists = await Material.findById(item.material);
        if (!materialExists) return next(new AppError(`Material ID ${item.material} not found`, 404));
    }

    // ── Evaluate Approval Rules for Inventory (مخزون) ──
    // In our UI, Material Issue rules are usually "جميع الحالات" (All cases).
    // We fetch the rule that applies to "مخزون"
    const approvalRule = await ApprovalRule.findOne({ entityType: "مخزون", isActive: true }).populate("workflow");
    
    let assignedWorkflow = null;
    let initialStatus = "PENDING";
    let initialStepIndex = 0;

    if (approvalRule && approvalRule.workflow && approvalRule.workflow.isActive && approvalRule.workflow.steps.length > 0) {
        assignedWorkflow = approvalRule.workflow._id;
        initialStatus = "PENDING_APPROVAL";
        initialStepIndex = 0; // Starts at 0 (representing stepOrder 1 usually)
    }

    const request = await MaterialRequest.create({
        project,
        materials,
        notes,
        requestedBy: req.user._id,
        status: initialStatus,
        workflow: assignedWorkflow,
        currentStepIndex: initialStepIndex,
        approvalHistory: []
    });

    await request.populate("project", "name");
    await request.populate("materials.material", "name unit");

    // 🔔 Notify managers: pending approval
    emitToManagers("notification:approval_pending", {
        requestId: request._id,
        projectName: request.project?.name,
        requestedBy: req.user._id,
        materialsCount: materials.length,
        createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
        success: true,
        message: "Material request created successfully",
        data: request
    });
});

/** Update material request */
export const updateRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { materials, notes } = req.body;

    const request = await MaterialRequest.findById(id);
    if (!request) return next(new AppError("Material request not found", 404));
    if (request.status !== "PENDING") return next(new AppError("Cannot update request that is not pending", 400));

    if (materials) {
        for (const item of materials) {
            const materialExists = await Material.findById(item.material);
            if (!materialExists) return next(new AppError(`Material ID ${item.material} not found`, 404));
        }
        request.materials = materials;
    }
    if (notes !== undefined) request.notes = notes;

    await request.save();
    await request.populate("project", "name");
    await request.populate("materials.material", "name unit");

    return res.status(200).json({ success: true, message: "Material request updated successfully", data: request });
});

/** Delete material request */
export const deleteRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    if (!request) return next(new AppError("Material request not found", 404));
    if (request.status !== "PENDING") return next(new AppError("Cannot delete request that is not pending", 400));

    await request.deleteOne();
    return res.status(200).json({ success: true, message: "Material request deleted successfully" });
});

/** Approve material request — notifies requester + project room */
export const approveRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { comments } = req.body;

    const request = await MaterialRequest.findById(id)
        .populate("project", "name")
        .populate({
            path: "workflow",
            populate: { path: "steps.role", select: "_id name" }
        });

    if (!request) return next(new AppError("Material request not found", 404));

    if (request.status === "PENDING") {
        // Fallback: No workflow attached, immediate approval
        request.status = "APPROVED";
        await request.save();
        await request.populate("materials.material", "name unit");

        // 🔔 Notify requester
        await createNotification(request.requestedBy, '✅ طلب المواد تم قبوله', `تم قبول طلب المواد الخاص بك في مشروع "${request.project?.name}".`, 'SUCCESS', { requestId: request._id, projectId: request.project?._id });
        emitToProject(String(request.project?._id), 'approval:approved', { requestId: request._id, projectId: request.project?._id, approvedBy: req.user._id, timestamp: new Date().toISOString() });
        return res.status(200).json({ success: true, message: "Material request approved successfully", data: request });
    }

    if (request.status !== "PENDING_APPROVAL") {
        return next(new AppError(`Only pending requests can be approved. Current status: ${request.status}`, 400));
    }

    // Step-by-Step Workflow Authentication Logic
    const workflow = request.workflow;
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        return next(new AppError("Workflow constraints not setup properly for this request.", 500));
    }

    const currentStepIndex = request.currentStepIndex || 0;
    const currentStep = workflow.steps[currentStepIndex];

    if (!currentStep) return next(new AppError("Invalid workflow step.", 500));

    let isAuthorized = false;
    if (currentStep.user && String(currentStep.user) === String(req.user._id)) {
        isAuthorized = true;
    } else if (currentStep.role) {
        const userRoleId = String(req.user.role._id || req.user.role);
        const stepRoleId = String(currentStep.role._id || currentStep.role);
        if (userRoleId === stepRoleId) isAuthorized = true;
    }

    // Allow Admin override?
    // if (req.user.role.name === 'admin' || req.user.role.name === 'Super Admin') isAuthorized = true;

    if (!isAuthorized) {
        return next(new AppError("You do not have permission to approve the current workflow step.", 403));
    }

    // Record Approval
    request.approvalHistory.push({
        stepIndex: currentStepIndex,
        role: currentStep.role ? currentStep.role._id : undefined,
        user: currentStep.user,
        approvedBy: req.user._id,
        status: "APPROVED",
        comment: comments || "",
        timestamp: new Date()
    });

    // Determine completion
    if (currentStepIndex === workflow.steps.length - 1) {
        // Fully Approved
        request.status = "APPROVED";
        await request.save();
        await request.populate("materials.material", "name unit");

        await createNotification(request.requestedBy, '✅ طلب المواد تم الموافقة عليه بالكامل', `تم اكتمال سلسلة الاعتمادات لطلب المواد الخاص بك في مشروع "${request.project?.name}".`, 'SUCCESS', { requestId: request._id, projectId: request.project?._id });
        emitToProject(String(request.project?._id), 'approval:approved', { requestId: request._id, projectId: request.project?._id, approvedBy: req.user._id, timestamp: new Date().toISOString() });

        return res.status(200).json({ success: true, message: "Workflow complete. Request is fully approved.", data: request });
    } else {
        request.currentStepIndex += 1;
        await request.save();

        // Optional: Notify next role (omitted for brevity, could emit notification here)
        return res.status(200).json({ success: true, message: `Step ${currentStepIndex + 1} approved. Moved to next step.`, data: request });
    }
});

/** Reject material request — notifies requester */
export const rejectRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await MaterialRequest.findById(id)
        .populate("project", "name")
        .populate({
            path: "workflow",
            populate: { path: "steps.role", select: "_id name" }
        });

    if (!request) return next(new AppError("Material request not found", 404));

    if (request.status === "PENDING") {
        request.status = "REJECTED";
        if (reason) request.notes = (request.notes || "") + `\nRejection reason: ${reason}`;
        await request.save();
        await request.populate("materials.material", "name unit");

        // 🔔 Notify requester
        await createNotification(request.requestedBy, '❌ طلب المواد تم رفضه', `تم رفض طلب المواد الخاص بك في مشروع "${request.project?.name}". ${reason ? 'السبب: ' + reason : ''}`, 'ERROR', { requestId: request._id, projectId: request.project?._id });
        emitToProject(String(request.project?._id), 'approval:rejected', { requestId: request._id, projectId: request.project?._id, reason, rejectedBy: req.user._id, timestamp: new Date().toISOString() });

        return res.status(200).json({ success: true, message: "Material request rejected", data: request });
    }

    if (request.status !== "PENDING_APPROVAL") {
        return next(new AppError(`Only pending requests can be rejected. Current status: ${request.status}`, 400));
    }

    const workflow = request.workflow;
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
        return next(new AppError("Workflow constraints not setup properly for this request.", 500));
    }

    const currentStepIndex = request.currentStepIndex || 0;
    const currentStep = workflow.steps[currentStepIndex];

    if (!currentStep) return next(new AppError("Invalid workflow step.", 500));

    let isAuthorized = false;
    if (currentStep.user && String(currentStep.user) === String(req.user._id)) {
        isAuthorized = true;
    } else if (currentStep.role) {
        const userRoleId = String(req.user.role._id || req.user.role);
        const stepRoleId = String(currentStep.role._id || currentStep.role);
        if (userRoleId === stepRoleId) isAuthorized = true;
    }

    if (!isAuthorized) {
        return next(new AppError("You do not have permission to reject the current workflow step.", 403));
    }

    // Record Rejection in History
    request.approvalHistory.push({
        stepIndex: currentStepIndex,
        role: currentStep.role ? currentStep.role._id : undefined,
        user: currentStep.user,
        approvedBy: req.user._id,
        status: "REJECTED",
        comment: reason || "",
        timestamp: new Date()
    });

    request.status = "REJECTED";
    await request.save();
    await request.populate("materials.material", "name unit");

    // 🔔 Notify requester
    await createNotification(request.requestedBy, '❌ طلب المواد تم رفضه للاعتماد', `تم رفض طلب المواد الخاص بك في سلسلة الاعتمادات لمشروع "${request.project?.name}". ${reason ? 'السبب: ' + reason : ''}`, 'ERROR', { requestId: request._id, projectId: request.project?._id });
    emitToProject(String(request.project?._id), 'approval:rejected', { requestId: request._id, projectId: request.project?._id, reason, rejectedBy: req.user._id, timestamp: new Date().toISOString() });

    return res.status(200).json({ success: true, message: "Workflow rejected. Request marked as REJECTED.", data: request });
});

/** Fulfill material request — checks low stock after deduction */
export const fulfillRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id)
        .populate("project", "name warehouseType dedicatedWarehouse")
        .populate("materials.material", "name unit minStock");
    if (!request) return next(new AppError("Material request not found", 404));
    if (request.status !== "APPROVED") return next(new AppError("Only approved requests can be fulfilled", 400));

    const project = request.project;

    // Fetch MAIN warehouses to deduct stock from
    const mainWarehouses = await mongoose.model("Warehouse").find({ type: "MAIN" }).select("_id");
    const mainWarehouseIds = mainWarehouses.map(w => w._id);

    // Deduct from inventory and check low stock
    for (const item of request.materials) {
        // Find Stock in MAIN warehouses
        const stock = await Inventory.findOne({ 
            material: item.material._id, 
            warehouse: { $in: mainWarehouseIds },
            quantity: { $gte: item.quantity }
        });

        if (!stock) {
            return next(new AppError(`Insufficient stock in main warehouses for material ${item.material.name}`, 400));
        }

        let inv; // Final inventory record we issued from (for low stock checks)

        if (project.warehouseType === "DEDICATED" && project.dedicatedWarehouse) {
            // STEP 1: Transfer from MAIN to DEDICATED
            stock.quantity -= item.quantity;
            await stock.save();

            // TRANSFER transaction
            await MaterialTransaction.create({
                project: project._id,
                material: item.material._id,
                quantity: item.quantity,
                type: "ISSUE", 
                warehouse: project.dedicatedWarehouse,
                referenceRequest: request._id,
                createdBy: req.user._id
            });

            // Add to DEDICATED inventory
            const dedicatedStock = await Inventory.findOneAndUpdate(
                { material: item.material._id, warehouse: project.dedicatedWarehouse },
                { $inc: { quantity: item.quantity }, $set: { lastUpdated: new Date() } },
                { upsert: true, new: true }
            );

            // STEP 2: Issue from DEDICATED
            dedicatedStock.quantity -= item.quantity;
            await dedicatedStock.save();
            inv = dedicatedStock;

            // ISSUE transaction
            await MaterialTransaction.create({
                project: project._id,
                material: item.material._id,
                quantity: item.quantity,
                type: "ISSUE",
                warehouse: project.dedicatedWarehouse,
                referenceRequest: request._id,
                createdBy: req.user._id
            });

        } else {
            // Direct Issue from MAIN
            stock.quantity -= item.quantity;
            await stock.save();
            inv = stock;

            await MaterialTransaction.create({
                project: project._id,
                material: item.material._id,
                quantity: item.quantity,
                type: "ISSUE",
                warehouse: stock.warehouse,
                referenceRequest: request._id,
                createdBy: req.user._id
            });
        }

        // C. Update Project Material (Issued Quantity)
        await ProjectMaterial.findOneAndUpdate(
            { project: project._id, material: item.material._id },
            { $inc: { issuedQuantity: item.quantity } },
            { upsert: true }
        );

        if (inv) {
            const minStock = item.material.minStock || 0;

            // 📊 Broadcast live inventory update
            emitInventoryUpdate({
                materialId: String(item.material._id),
                materialName: item.material.name,
                newQuantity: inv.quantity,
                deducted: item.quantity,
                projectId: String(request.project?._id),
                timestamp: new Date().toISOString(),
            });

            // ⚠️ Low stock alert
            if (inv.quantity <= minStock) {
                emitToManagers('inventory:low_stock', {
                    materialId: String(item.material._id),
                    materialName: item.material.name,
                    currentQuantity: inv.quantity,
                    minStock,
                    timestamp: new Date().toISOString(),
                });

                // Persist low stock notification for managers
                const managers = await User.find({ role: { $in: ['manager', 'admin'] } });
                await Promise.all(
                    managers.map(m =>
                        createNotification(
                            m._id,
                            `📉 مخزون منخفض: ${item.material.name}`,
                            `الكمية المتبقية من "${item.material.name}" (${inv.quantity}) أقل من الحد الأدنى (${minStock}).`,
                            'WARNING',
                            { materialId: item.material._id, currentQuantity: inv.quantity, minStock }
                        ).catch(() => { }) // don't block fulfill if notify fails
                    )
                );
            }
        }
    }

    request.status = "FULFILLED";
    await request.save();

    // 🔔 Notify requester
    await createNotification(
        request.requestedBy,
        '📦 تم توريد المواد',
        `تم توريد المواد لمشروع "${request.project?.name}" بنجاح.`,
        'SUCCESS',
        { requestId: request._id, projectId: request.project?._id }
    );

    return res.status(200).json({ success: true, message: "Material request marked as fulfilled", data: request });
});
