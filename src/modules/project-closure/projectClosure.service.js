import ProjectClosure from "../../db/models/projects/projectClosure.model.js";
import Certificate from "../../db/models/projects/certificate.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// POST /api/projects/:projectId/closure — initiate closure process
export const initiateClosure = asynchandler(async (req, res, next) => {
    const existing = await ProjectClosure.findOne({ project: req.params.projectId });
    if (existing) return next(new AppError("Project closure already initiated", 400));

    const { checklists, approvals } = req.body;
    const closure = await ProjectClosure.create({
        project: req.params.projectId,
        checklists: checklists || [
            { item: "Site Delivery Completed" },
            { item: "Materials Returned to Warehouse" },
            { item: "Financial Clearance Done" },
            { item: "Client Approval Obtained" },
            { item: "Final Documentation Archived" }
        ],
        approvals: approvals || [
            { role: "PROJECT_MANAGER", status: "PENDING" },
            { role: "FINANCIAL_DIRECTOR", status: "PENDING" },
            { role: "CEO", status: "PENDING" }
        ],
        initiatedBy: req.user._id,
        initiatedAt: new Date()
    });
    return res.status(201).json({ success: true, message: "Project closure initiated", data: closure });
});

// GET /api/projects/:projectId/closure
export const getClosure = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId })
        .populate("checklists.completedBy", "name")
        .populate("approvals.user", "name email");
    if (!closure) return next(new AppError("No closure process found for this project", 404));
    return res.status(200).json({ success: true, data: closure });
});

// PUT /api/projects/:projectId/closure/checklist/:itemId — complete a checklist item
export const updateChecklistItem = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure) return next(new AppError("Closure not found", 404));

    const item = closure.checklists.id(req.params.itemId);
    if (!item) return next(new AppError("Checklist item not found", 404));

    item.isCompleted = true;
    item.completedBy = req.user._id;
    item.completedAt = new Date();
    await closure.save();

    return res.status(200).json({ success: true, message: "Checklist item completed", data: closure });
});

// PUT /api/projects/:projectId/closure/approve — sign-off by a role
export const approveClosure = asynchandler(async (req, res, next) => {
    const { status, notes } = req.body;
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure) return next(new AppError("Closure not found", 404));

    // Find this user's approval slot
    const slot = closure.approvals.find(a => a.user?.toString() === req.user._id.toString() && a.status === "PENDING");
    if (!slot) return next(new AppError("No pending approval found for this user", 404));

    slot.status = status;
    slot.actionDate = new Date();
    slot.notes = notes;

    // Check if all mandatory approvals are done
    const allApproved = closure.approvals.every(a => a.status === "APPROVED");
    if (allApproved) {
        closure.closureStatus = "CLOSED";
        closure.closedAt = new Date();
    }
    await closure.save();

    return res.status(200).json({ success: true, message: `Closure ${status.toLowerCase()}`, data: closure });
});

// POST /api/projects/:projectId/closure/certificate — generate completion certificate
export const generateCertificate = asynchandler(async (req, res, next) => {
    const closure = await ProjectClosure.findOne({ project: req.params.projectId });
    if (!closure || closure.closureStatus !== "CLOSED") {
        return next(new AppError("Project must be fully closed before generating a certificate", 400));
    }

    const existing = await Certificate.findOne({ project: req.params.projectId });
    if (existing) return res.status(200).json({ success: true, data: existing });

    const certificate = await Certificate.create({
        project: req.params.projectId,
        projectClosure: closure._id,
        issuedBy: req.user._id,
        signatories: req.body.signatories || []
    });

    return res.status(201).json({ success: true, message: "Certificate generated", data: certificate });
});
