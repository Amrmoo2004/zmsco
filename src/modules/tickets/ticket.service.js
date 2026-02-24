import Ticket from "../../db/models/tickets/ticket.model.js";
import { AppError } from "../../utils/appError.js";
import { asynchandler } from "../../utils/response/response.js";

export const getTickets = asynchandler(async (req, res) => {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    const tickets = await Ticket.find(filter)
        .populate("requester", "name email")
        .populate("assignedTeam", "name email")
        .populate("project", "name")
        .populate("equipment", "name type")
        .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: tickets });
});

export const getTicketById = asynchandler(async (req, res, next) => {
    const ticket = await Ticket.findById(req.params.id)
        .populate("requester", "name email")
        .populate("assignedTeam", "name email")
        .populate("project", "name")
        .populate("equipment", "name type")
        .populate("history.changedBy", "name")
        .populate("comments.user", "name");
    if (!ticket) return next(new AppError("Ticket not found", 404));
    return res.status(200).json({ success: true, data: ticket });
});

export const createTicket = asynchandler(async (req, res) => {
    const ticket = await Ticket.create({ ...req.body, requester: req.user._id, status: "NEW" });
    return res.status(201).json({ success: true, message: "Ticket created", data: ticket });
});

export const updateTicketStatus = asynchandler(async (req, res, next) => {
    const { status, assignedTeam, rejectionReason, notes } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));

    // Record in history
    ticket.history.push({ status, changedBy: req.user._id, timestamp: new Date(), notes });
    ticket.status = status;
    if (assignedTeam) ticket.assignedTeam = assignedTeam;
    if (rejectionReason) ticket.rejectionReason = rejectionReason;
    await ticket.save();

    return res.status(200).json({ success: true, message: "Ticket status updated", data: ticket });
});

export const addComment = asynchandler(async (req, res, next) => {
    const { text } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));

    ticket.comments.push({ user: req.user._id, text, createdAt: new Date() });
    await ticket.save();

    return res.status(201).json({ success: true, message: "Comment added", data: ticket.comments });
});

export const deleteTicket = asynchandler(async (req, res, next) => {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return next(new AppError("Ticket not found", 404));
    return res.status(200).json({ success: true, message: "Ticket deleted" });
});
