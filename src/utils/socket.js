import { Server } from 'socket.io';
import { verifyToken } from './token.js';

let io = null;

// In-memory presence map: projectId → Set of { userId, name, socketId }
const projectPresence = new Map();

// ─── Initialize ───────────────────────────────────────────────────────────────

/**
 * Initialize Socket.IO. Must be called once at server startup.
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
        pingTimeout: 60000,
    });

    // JWT auth middleware
    io.use((socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace('Bearer ', '');
            if (!token) return next(new Error('Authentication error: token required'));
            const decoded = verifyToken(token);
            socket.userId = String(decoded.userId);
            socket.userName = decoded.name || 'Unknown';
            socket.userRole = decoded.role || 'user';
            next();
        } catch {
            next(new Error('Authentication error: invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`⚡ WS connected  userId=${socket.userId}  socketId=${socket.id}`);

        // ─── Always join the user's private room ─────────────────────────────────
        socket.join(`user:${socket.userId}`);

        // Role room (managers get system alerts)
        if (socket.userRole === 'admin' || socket.userRole === 'manager') {
            socket.join('role:manager');
        }

        // ─── Presence: join a project room ───────────────────────────────────────
        socket.on('project:join', ({ projectId }) => {
            if (!projectId) return;
            const room = `project:${projectId}`;
            socket.join(room);
            socket.currentProjectId = projectId;

            if (!projectPresence.has(projectId)) projectPresence.set(projectId, new Map());
            projectPresence.get(projectId).set(socket.userId, {
                userId: socket.userId,
                name: socket.userName,
                socketId: socket.id,
                joinedAt: new Date().toISOString(),
            });

            const viewers = [...projectPresence.get(projectId).values()];
            io.to(room).emit('project:presence:join', {
                projectId,
                user: { userId: socket.userId, name: socket.userName },
                viewers,
            });
        });

        // ─── Presence: leave a project room ──────────────────────────────────────
        socket.on('project:leave', ({ projectId }) => {
            _leaveProject(socket, projectId);
        });

        // ─── Join a warehouse room ────────────────────────────────────────────────
        socket.on('warehouse:join', ({ warehouseId }) => {
            if (warehouseId) socket.join(`warehouse:${warehouseId}`);
        });

        // ─── Client acknowledges a notification ──────────────────────────────────
        socket.on('notification:ack', ({ notificationId }) => {
            // Can be used to mark as read from client side in future
            console.log(`ACK notification ${notificationId} by user ${socket.userId}`);
        });

        // ─── Disconnect ───────────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`❌ WS disconnected userId=${socket.userId}`);
            if (socket.currentProjectId) {
                _leaveProject(socket, socket.currentProjectId);
            }
        });
    });

    console.log('✅ Socket.IO initialized with rooms: user:{id}, project:{id}, role:manager, warehouse:{id}');
    return io;
};

// ─── Internal helper ─────────────────────────────────────────────────────────

function _leaveProject(socket, projectId) {
    const room = `project:${projectId}`;
    socket.leave(room);
    const presence = projectPresence.get(projectId);
    if (presence) {
        presence.delete(socket.userId);
        if (presence.size === 0) {
            projectPresence.delete(projectId);
        } else {
            const viewers = [...presence.values()];
            io.to(room).emit('project:presence:leave', {
                projectId,
                user: { userId: socket.userId, name: socket.userName },
                viewers,
            });
        }
    }
}

// ─── Getters ─────────────────────────────────────────────────────────────────

export const getIO = () => {
    if (!io) throw new Error('Socket.IO not initialized.');
    return io;
};

/**
 * Get list of viewers currently viewing a project.
 */
export const getProjectViewers = (projectId) => {
    return projectPresence.has(projectId)
        ? [...projectPresence.get(projectId).values()]
        : [];
};

// ─── Targeted Emitters ───────────────────────────────────────────────────────

/** Send a real-time notification to a specific user. */
export const sendNotification = (userId, event, data) => {
    if (!io) return;
    io.to(`user:${String(userId)}`).emit(event, data);
};

/** Broadcast an event to all users viewing a specific project. */
export const emitToProject = (projectId, event, data) => {
    if (!io) return;
    io.to(`project:${projectId}`).emit(event, data);
};

/** Broadcast an event to all managers/admins. */
export const emitToManagers = (event, data) => {
    if (!io) return;
    io.to('role:manager').emit(event, data);
};

/** Broadcast an event to all clients in a warehouse room. */
export const emitToWarehouse = (warehouseId, event, data) => {
    if (!io) return;
    io.to(`warehouse:${warehouseId}`).emit(event, data);
};

/** Broadcast dashboard stats update to ALL connected clients. */
export const emitDashboardUpdate = (data) => {
    if (!io) return;
    io.emit('dashboard:update', data);
};

/** Broadcast inventory update to all connected clients. */
export const emitInventoryUpdate = (data) => {
    if (!io) return;
    io.emit('inventory:updated', data);
};
