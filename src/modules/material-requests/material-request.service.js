import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import Material from "../../db/models/metrials/metrials.js";
import Project from "../../db/models/projects/project.js";
import Inventory from "../../db/models/inventory.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";
import { createNotification } from "../notifications/notification.service.js";
import { emitToProject, emitToManagers, emitInventoryUpdate } from "../../utils/socket.js";
import User from "../../db/models/user.js";

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

    const request = await MaterialRequest.create({
        project,
        materials,
        notes,
        requestedBy: req.user._id,
        status: "PENDING"
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
    const request = await MaterialRequest.findById(id).populate("project", "name");
    if (!request) return next(new AppError("Material request not found", 404));
    if (request.status !== "PENDING") return next(new AppError("Only pending requests can be approved", 400));

    request.status = "APPROVED";
    await request.save();
    await request.populate("materials.material", "name unit");

    // 🔔 Notify requester
    await createNotification(
        request.requestedBy,
        '✅ طلب المواد تم قبوله',
        `تم قبول طلب المواد الخاص بك في مشروع "${request.project?.name}".`,
        'SUCCESS',
        { requestId: request._id, projectId: request.project?._id }
    );

    // 🔔 Broadcast to project room
    emitToProject(String(request.project?._id), 'approval:approved', {
        requestId: request._id,
        projectId: request.project?._id,
        approvedBy: req.user._id,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Material request approved successfully", data: request });
});

/** Reject material request — notifies requester */
export const rejectRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await MaterialRequest.findById(id).populate("project", "name");
    if (!request) return next(new AppError("Material request not found", 404));
    if (request.status !== "PENDING") return next(new AppError("Only pending requests can be rejected", 400));

    request.status = "REJECTED";
    if (reason) request.notes = (request.notes || "") + `\nRejection reason: ${reason}`;
    await request.save();
    await request.populate("materials.material", "name unit");

    // 🔔 Notify requester
    await createNotification(
        request.requestedBy,
        '❌ طلب المواد تم رفضه',
        `تم رفض طلب المواد الخاص بك في مشروع "${request.project?.name}". ${reason ? 'السبب: ' + reason : ''}`,
        'ERROR',
        { requestId: request._id, projectId: request.project?._id }
    );

    // 🔔 Broadcast to project room
    emitToProject(String(request.project?._id), 'approval:rejected', {
        requestId: request._id,
        projectId: request.project?._id,
        reason,
        rejectedBy: req.user._id,
        timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Material request rejected", data: request });
});

/** Fulfill material request — checks low stock after deduction */
export const fulfillRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id)
        .populate("project", "name")
        .populate("materials.material", "name unit minStock");
    if (!request) return next(new AppError("Material request not found", 404));
    if (request.status !== "APPROVED") return next(new AppError("Only approved requests can be fulfilled", 400));

    request.status = "FULFILLED";
    await request.save();

    // Deduct from inventory and check low stock
    for (const item of request.materials) {
        const inv = await Inventory.findOneAndUpdate(
            { material: item.material._id },
            { $inc: { quantity: -item.quantity }, $set: { lastUpdated: new Date() } },
            { new: true }
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
