import MaterialRequest from "../../db/models/metrials/materialRequest.model.js";
import Material from "../../db/models/metrials/metrials.js";
import Project from "../../db/models/projects/project.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

/**
 * Get all material requests with filters
 */
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

    return res.status(200).json({
        success: true,
        data: requests
    });
});

/**
 * Get request by ID
 */
export const getRequestById = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const request = await MaterialRequest.findById(id)
        .populate("project", "name")
        .populate("materials.material", "name unit")
        .populate("requestedBy", "name email");

    if (!request) {
        return next(new AppError("Material request not found", 404));
    }

    return res.status(200).json({
        success: true,
        data: request
    });
});

/**
 * Create material request
 */
export const createRequest = asynchandler(async (req, res, next) => {
    const { project, materials, notes } = req.body;

    // Validate project exists
    const projectExists = await Project.findById(project);
    if (!projectExists) {
        return next(new AppError("Project not found", 404));
    }

    // Validate materials exist
    for (const item of materials) {
        const materialExists = await Material.findById(item.material);
        if (!materialExists) {
            return next(new AppError(`Material ID ${item.material} not found`, 404));
        }
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

    return res.status(201).json({
        success: true,
        message: "Material request created successfully",
        data: request
    });
});

/**
 * Update material request
 */
export const updateRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { materials, notes } = req.body;

    const request = await MaterialRequest.findById(id);

    if (!request) {
        return next(new AppError("Material request not found", 404));
    }

    // Only allow updates if status is PENDING
    if (request.status !== "PENDING") {
        return next(new AppError("Cannot update request that is not pending", 400));
    }

    if (materials) {
        // Validate materials
        for (const item of materials) {
            const materialExists = await Material.findById(item.material);
            if (!materialExists) {
                return next(new AppError(`Material ID ${item.material} not found`, 404));
            }
        }
        request.materials = materials;
    }

    if (notes !== undefined) request.notes = notes;

    await request.save();
    await request.populate("project", "name");
    await request.populate("materials.material", "name unit");

    return res.status(200).json({
        success: true,
        message: "Material request updated successfully",
        data: request
    });
});

/**
 * Delete material request
 */
export const deleteRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const request = await MaterialRequest.findById(id);

    if (!request) {
        return next(new AppError("Material request not found", 404));
    }

    // Only allow deletion if status is PENDING
    if (request.status !== "PENDING") {
        return next(new AppError("Cannot delete request that is not pending", 400));
    }

    await request.deleteOne();

    return res.status(200).json({
        success: true,
        message: "Material request deleted successfully"
    });
});

/**
 * Approve material request
 */
export const approveRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const request = await MaterialRequest.findById(id);

    if (!request) {
        return next(new AppError("Material request not found", 404));
    }

    if (request.status !== "PENDING") {
        return next(new AppError("Only pending requests can be approved", 400));
    }

    request.status = "APPROVED";
    await request.save();

    await request.populate("project", "name");
    await request.populate("materials.material", "name unit");

    return res.status(200).json({
        success: true,
        message: "Material request approved successfully",
        data: request
    });
});

/**
 * Reject material request
 */
export const rejectRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await MaterialRequest.findById(id);

    if (!request) {
        return next(new AppError("Material request not found", 404));
    }

    if (request.status !== "PENDING") {
        return next(new AppError("Only pending requests can be rejected", 400));
    }

    request.status = "REJECTED";
    if (reason) request.notes = (request.notes || "") + `\nRejection reason: ${reason}`;
    await request.save();

    await request.populate("project", "name");
    await request.populate("materials.material", "name unit");

    return res.status(200).json({
        success: true,
        message: "Material request rejected",
        data: request
    });
});

/**
 * Fulfill material request
 */
export const fulfillRequest = asynchandler(async (req, res, next) => {
    const { id } = req.params;

    const request = await MaterialRequest.findById(id);

    if (!request) {
        return next(new AppError("Material request not found", 404));
    }

    if (request.status !== "APPROVED") {
        return next(new AppError("Only approved requests can be fulfilled", 400));
    }

    request.status = "FULFILLED";
    await request.save();

    await request.populate("project", "name");
    await request.populate("materials.material", "name unit");

    return res.status(200).json({
        success: true,
        message: "Material request marked as fulfilled",
        data: request
    });
});
