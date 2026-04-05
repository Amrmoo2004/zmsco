import AuditLog from "../../db/models/settings/auditLog.model.js";
import { asynchandler } from "../../utils/response/response.js";

// GET /api/audit-logs
export const getAuditLogs = asynchandler(async (req, res) => {
    const { user, entity, action, status, from, to, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (user) filter.user = user;
    if (entity) filter.entity = entity;
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
        AuditLog.find(filter)
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        AuditLog.countDocuments(filter)
    ]);

    return res.status(200).json({
        success: true,
        data: logs,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// GET /api/audit-logs/:id
export const getAuditLogById = asynchandler(async (req, res, next) => {
    const log = await AuditLog.findById(req.params.id).populate("user", "name email");
    if (!log) return next(new Error("Audit log not found"));
    return res.status(200).json({ success: true, data: log });
});

// GET /api/audit-logs/summary
export const getAuditSummary = asynchandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, totalCount, byAction, byEntity, recentUsers] = await Promise.all([
        AuditLog.countDocuments({ createdAt: { $gte: today } }),
        AuditLog.countDocuments(),
        AuditLog.aggregate([
            { $group: { _id: "$action", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        AuditLog.aggregate([
            { $group: { _id: "$entity", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]),
        AuditLog.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: { _id: "$user", lastAction: { $first: "$action" }, lastAt: { $first: "$createdAt" } } },
            { $limit: 5 },
            { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
            { $unwind: "$userInfo" }
        ])
    ]);

    return res.status(200).json({
        success: true,
        data: { todayCount, totalCount, byAction, byEntity, recentUsers }
    });
});

// Helper: create audit log (for use in other services)
export const createAuditLog = async ({ action, entity, entityId, entityName, user, changes, description, req }) => {
    try {
        await AuditLog.create({
            action,
            entity,
            entityId,
            entityName,
            user,
            changes,
            description,
            ip: req?.ip || req?.connection?.remoteAddress,
            userAgent: req?.headers?.["user-agent"],
            status: "SUCCESS"
        });
    } catch (err) {
        console.error("Audit log creation failed:", err.message);
    }
};
