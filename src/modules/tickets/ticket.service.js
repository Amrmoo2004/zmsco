import Ticket from "../../db/models/tickets/ticket.model.js";
import { uploadFile, removeFile } from "../attachments/attachment.service.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

// ─────────────────────────────────────────────
// Shared populate config
// ─────────────────────────────────────────────
const POPULATE_LIST = [
    { path: "requester", select: "name email" },
    { path: "assignedTeam", select: "name email" },
    { path: "project", select: "name" },
    { path: "projectPhase", select: "name" },
    { path: "equipment", select: "name type" },
];

const POPULATE_DETAIL = [
    ...POPULATE_LIST,
    { path: "history.changedBy", select: "name" },
    { path: "comments.user", select: "name" },
    { path: "attachments.uploadedBy", select: "name" },
];

// ─────────────────────────────────────────────
// GET /api/tickets
// Returns list + summary counts + pagination
// ─────────────────────────────────────────────
export const getTickets = asynchandler(async (req, res) => {
    const {
        project, type, status, priority,
        from, to,
        page = 1, limit = 10,
        search
    } = req.query;

    const filter = {};
    if (project)  filter.project  = project;
    if (type)     filter.type     = type;
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;

    // Date range filter
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to)   filter.createdAt.$lte = new Date(to);
    }

    // Search by requestId
    if (search) {
        filter.requestId = { $regex: search, $options: "i" };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Ticket.countDocuments(filter);

    const tickets = await Ticket.find(filter)
        .populate(POPULATE_LIST)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    // Summary counts (always on full collection, no pagination)
    const [summary] = await Ticket.aggregate([
        {
            $group: {
                _id: null,
                total:            { $sum: 1 },
                NEW:              { $sum: { $cond: [{ $eq: ["$status", "NEW"] },              1, 0] } },
                UNDER_REVIEW:     { $sum: { $cond: [{ $eq: ["$status", "UNDER_REVIEW"] },     1, 0] } },
                AWAITING_APPROVAL:{ $sum: { $cond: [{ $eq: ["$status", "AWAITING_APPROVAL"] },1, 0] } },
                IN_PROGRESS:      { $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] },      1, 0] } },
                COMPLETED:        { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] },        1, 0] } },
                REJECTED:         { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] },         1, 0] } },
            }
        }
    ]);

    return res.status(200).json({
        success: true,
        summary: summary || {
            total: 0, NEW: 0, UNDER_REVIEW: 0,
            AWAITING_APPROVAL: 0, IN_PROGRESS: 0,
            COMPLETED: 0, REJECTED: 0
        },
        pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
        data: tickets,
    });
});

// ─────────────────────────────────────────────
// GET /api/tickets/stats  — Reports page
// ─────────────────────────────────────────────
export const getTicketStats = asynchandler(async (req, res) => {
    const { from, to } = req.query;

    const dateMatch = {};
    if (from || to) {
        dateMatch.createdAt = {};
        if (from) dateMatch.createdAt.$gte = new Date(from);
        if (to)   dateMatch.createdAt.$lte = new Date(to);
    }

    // 1) Totals by status
    const byStatus = await Ticket.aggregate([
        { $match: dateMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // 2) Totals by type
    const byType = await Ticket.aggregate([
        { $match: dateMatch },
        { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    // 3) Per-project stats (name + total + completed + avgDays)
    const byProject = await Ticket.aggregate([
        { $match: dateMatch },
        {
            $group: {
                _id: "$project",
                total:     { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
                // avg days from createdAt → targetDate (for completed tickets)
                avgDays: {
                    $avg: {
                        $cond: [
                            { $and: [{ $eq: ["$status", "COMPLETED"] }, { $ifNull: ["$targetDate", false] }] },
                            { $divide: [{ $subtract: ["$targetDate", "$createdAt"] }, 86400000] },
                            null
                        ]
                    }
                }
            }
        },
        {
            $lookup: {
                from: "projects",
                localField: "_id",
                foreignField: "_id",
                as: "project"
            }
        },
        { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                projectName: { $ifNull: ["$project.name", "غير محدد"] },
                total: 1,
                completed: 1,
                completionRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
                        0
                    ]
                },
                avgDays: { $round: ["$avgDays", 1] }
            }
        }
    ]);

    // 4) Per-team member performance
    const byTeam = await Ticket.aggregate([
        { $match: dateMatch },
        { $unwind: "$assignedTeam" },
        {
            $group: {
                _id: "$assignedTeam",
                total:     { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "member"
            }
        },
        { $unwind: "$member" },
        {
            $project: {
                memberName: "$member.name",
                total: 1,
                completed: 1,
                completionRate: {
                    $cond: [
                        { $gt: ["$total", 0] },
                        { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
                        0
                    ]
                }
            }
        }
    ]);

    // 5) Overall KPIs
    const [kpis] = await Ticket.aggregate([
        { $match: dateMatch },
        {
            $group: {
                _id: null,
                total:      { $sum: 1 },
                completed:  { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] },  1, 0] } },
                rejected:   { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] },   1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ["$status", "IN_PROGRESS"] },1, 0] } },
                avgCompletionDays: {
                    $avg: {
                        $cond: [
                            { $and: [{ $eq: ["$status", "COMPLETED"] }, { $ifNull: ["$targetDate", false] }] },
                            { $divide: [{ $subtract: ["$targetDate", "$createdAt"] }, 86400000] },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    return res.status(200).json({
        success: true,
        data: {
            kpis: kpis || { total: 0, completed: 0, rejected: 0, inProgress: 0, avgCompletionDays: 0 },
            byStatus,
            byType,
            byProject,
            byTeam,
        }
    });
});

// ─────────────────────────────────────────────
// GET /api/tickets/:id
// ─────────────────────────────────────────────
export const getTicketById = asynchandler(async (req, res, next) => {
    const ticket = await Ticket.findById(req.params.id).populate(POPULATE_DETAIL);
    if (!ticket) return next(new AppError("Ticket not found", 404));
    return res.status(200).json({ success: true, data: ticket });
});

// ─────────────────────────────────────────────
// POST /api/tickets  — Create (with optional file attachments)
// ─────────────────────────────────────────────
export const createTicket = asynchandler(async (req, res) => {
    const {
        type, project, projectPhase, equipment,
        description, priority, targetDate, reviewNotes
    } = req.body;

    const ticket = await Ticket.create({
        type, project, projectPhase, equipment,
        description, priority, targetDate, reviewNotes,
        requester: req.user._id,
        status: "NEW"
    });

    // Upload attachments if provided (multipart, field: files)
    if (req.files && req.files.length > 0) {
        const uploads = await Promise.all(
            req.files.map(f =>
                uploadFile(f, req.user._id, { refModel: "Ticket", refId: ticket._id }, "zmsco-tickets")
            )
        );
        ticket.attachments = uploads.map(a => ({
            url: a.url,
            publicId: a.publicId,
            originalName: a.originalName,
            mimeType: a.mimeType,
            uploadedBy: req.user._id
        }));
        await ticket.save();
    }

    return res.status(201).json({ success: true, message: "تم إنشاء الطلب بنجاح", data: ticket });
});

// ─────────────────────────────────────────────
// PATCH /api/tickets/:id  — Update ticket fields
// ─────────────────────────────────────────────
export const updateTicket = asynchandler(async (req, res, next) => {
    const allowedFields = [
        "type", "project", "projectPhase", "equipment",
        "description", "priority", "targetDate", "reviewNotes", "assignedTeam"
    ];

    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const ticket = await Ticket.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
    ).populate(POPULATE_LIST);

    if (!ticket) return next(new AppError("Ticket not found", 404));

    return res.status(200).json({ success: true, message: "تم تحديث الطلب", data: ticket });
});

// ─────────────────────────────────────────────
// PUT /api/tickets/:id/status — Workflow status change
// ─────────────────────────────────────────────
export const updateTicketStatus = asynchandler(async (req, res, next) => {
    const { status, assignedTeam, rejectionReason, notes, reviewNotes } = req.body;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));

    // Record history entry
    ticket.history.push({
        status,
        changedBy: req.user._id,
        timestamp: new Date(),
        notes
    });

    ticket.status = status;
    if (assignedTeam)     ticket.assignedTeam     = assignedTeam;
    if (rejectionReason)  ticket.rejectionReason  = rejectionReason;
    if (reviewNotes)      ticket.reviewNotes       = reviewNotes;

    await ticket.save();
    await ticket.populate(POPULATE_LIST);

    return res.status(200).json({ success: true, message: "تم تحديث حالة الطلب", data: ticket });
});

// ─────────────────────────────────────────────
// POST /api/tickets/:id/comments
// ─────────────────────────────────────────────
export const addComment = asynchandler(async (req, res, next) => {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));

    ticket.comments.push({ user: req.user._id, text, createdAt: new Date() });
    await ticket.save();

    return res.status(201).json({ success: true, message: "تم إضافة التعليق", data: ticket.comments });
});

// ─────────────────────────────────────────────
// POST /api/tickets/:id/attachments — Upload files to existing ticket
// ─────────────────────────────────────────────
export const uploadTicketAttachments = asynchandler(async (req, res, next) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));

    if (!req.files || req.files.length === 0) {
        return next(new AppError("لم يتم رفع أي ملف", 400));
    }

    const uploads = await Promise.all(
        req.files.map(f =>
            uploadFile(f, req.user._id, { refModel: "Ticket", refId: ticket._id }, "zmsco-tickets")
        )
    );

    const newAttachments = uploads.map(a => ({
        url: a.url,
        publicId: a.publicId,
        originalName: a.originalName,
        mimeType: a.mimeType,
        uploadedBy: req.user._id
    }));

    ticket.attachments.push(...newAttachments);
    await ticket.save();

    return res.status(201).json({ success: true, message: "تم رفع الملفات", data: ticket.attachments });
});

// ─────────────────────────────────────────────
// DELETE /api/tickets/:id/attachments/:attachmentId
// ─────────────────────────────────────────────
export const deleteTicketAttachment = asynchandler(async (req, res, next) => {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));

    const att = ticket.attachments.id(req.params.attachmentId);
    if (!att) return next(new AppError("Attachment not found", 404));

    // Remove from Cloudinary
    try {
        await removeFile(att.publicId, req.user._id);
    } catch (_) { /* silently skip if already deleted from cloudinary */ }

    att.deleteOne();
    await ticket.save();

    return res.status(200).json({ success: true, message: "تم حذف المرفق" });
});

// ─────────────────────────────────────────────
// DELETE /api/tickets/:id
// ─────────────────────────────────────────────
export const deleteTicket = asynchandler(async (req, res, next) => {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));
    return res.status(200).json({ success: true, message: "تم حذف الطلب" });
});
