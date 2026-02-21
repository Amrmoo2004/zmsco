import Notification from '../../db/models/notification.model.js';
import { sendNotification, emitToManagers } from '../../utils/socket.js';
import { asynchandler } from '../../utils/response/response.js';
import { AppError } from '../../utils/appError.js';

/**
 * Emit a system error / warning to managers/admins only (not persisted).
 * @param {'system:error'|'system:warning'} event
 * @param {string} message
 * @param {object} data
 */
export const emitSystemEvent = (event, message, data = {}) => {
    emitToManagers(event, { message, ...data, timestamp: new Date().toISOString() });
};


/**
 * Create a notification, persist it, and push via Socket.IO.
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 * @param {string} type  - 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
 * @param {object} data  - Optional extra payload
 */
export const createNotification = async (userId, title, body, type = 'INFO', data = {}) => {
    const notification = await Notification.create({ user: userId, title, body, type, data });
    // Push in real-time to the user's socket room
    sendNotification(String(userId), 'notification', {
        _id: notification._id,
        title,
        body,
        type,
        isRead: false,
        data,
        createdAt: notification.createdAt,
    });
    return notification;
};

/**
 * GET /api/notifications — list authenticated user's notifications
 */
export const getUserNotifications = asynchandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50);

    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        isRead: false,
    });

    return res.status(200).json({
        success: true,
        data: { notifications, unreadCount },
    });
});

/**
 * PATCH /api/notifications/:id/read — mark one as read
 */
export const markAsRead = asynchandler(async (req, res, next) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    return res.status(200).json({ success: true, data: notification });
});

/**
 * PATCH /api/notifications/read-all — mark all as read
 */
export const markAllAsRead = asynchandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

/**
 * DELETE /api/notifications/:id — delete a notification
 */
export const deleteNotification = asynchandler(async (req, res, next) => {
    const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id,
    });

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    return res.status(200).json({ success: true, message: 'Notification deleted' });
});
