const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Collection = require('../models/Collection');
const User = require('../models/User');

class RealtimeService {
    constructor() {
        this.io = null;
        this.activeUsers = new Map(); // userId -> Set of socketIds
        this.roomUsers = new Map(); // roomId -> Set of userIds
    }

    initialize(server) {
        this.io = socketIO(server, {
            cors: {
                origin: process.env.CLIENT_URL,
                methods: ['GET', 'POST'],
                credentials: true
            }
        });

        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication required'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (!user) {
                    return next(new Error('User not found'));
                }

                socket.user = user;
                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });

        this.io.on('connection', this._handleConnection.bind(this));
    }

    _handleConnection(socket) {
        console.log(`User connected: ${socket.user.username}`);

        // Add user to active users
        this._addActiveUser(socket.user._id, socket.id);

        // Join collection rooms
        socket.on('joinCollection', async (collectionId) => {
            try {
                const collection = await Collection.findById(collectionId);
                if (!collection || !collection.hasPermission(socket.user._id)) {
                    throw new Error('Not authorized');
                }

                const room = `collection:${collectionId}`;
                socket.join(room);
                this._addUserToRoom(room, socket.user._id);

                // Notify others in room
                socket.to(room).emit('userJoined', {
                    userId: socket.user._id,
                    username: socket.user.username
                });

                // Send active users list
                const activeUsers = await this._getActiveUsersInRoom(room);
                socket.emit('activeUsers', activeUsers);
            } catch (error) {
                socket.emit('error', error.message);
            }
        });

        // Handle real-time collaboration events
        socket.on('imageUpdate', async (data) => {
            try {
                const { collectionId, imageId, updates } = data;
                const room = `collection:${collectionId}`;

                // Verify permission
                const collection = await Collection.findById(collectionId);
                if (!collection || !collection.hasPermission(socket.user._id, 'editor')) {
                    throw new Error('Not authorized');
                }

                // Broadcast update to room
                socket.to(room).emit('imageUpdated', {
                    imageId,
                    updates,
                    updatedBy: {
                        id: socket.user._id,
                        username: socket.user.username
                    }
                });
            } catch (error) {
                socket.emit('error', error.message);
            }
        });

        // Handle cursor position updates
        socket.on('cursorMove', (data) => {
            const { collectionId, position } = data;
            const room = `collection:${collectionId}`;

            socket.to(room).emit('cursorMoved', {
                userId: socket.user._id,
                username: socket.user.username,
                position
            });
        });

        // Handle collection changes
        socket.on('collectionChange', async (data) => {
            try {
                const { collectionId, type, payload } = data;
                const room = `collection:${collectionId}`;

                // Verify permission
                const collection = await Collection.findById(collectionId);
                if (!collection || !collection.hasPermission(socket.user._id, 'editor')) {
                    throw new Error('Not authorized');
                }

                // Broadcast change to room
                socket.to(room).emit('collectionChanged', {
                    type,
                    payload,
                    changedBy: {
                        id: socket.user._id,
                        username: socket.user.username
                    }
                });
            } catch (error) {
                socket.emit('error', error.message);
            }
        });

        // Handle presence updates
        socket.on('updatePresence', (data) => {
            const { collectionId, status } = data;
            const room = `collection:${collectionId}`;

            socket.to(room).emit('presenceUpdated', {
                userId: socket.user._id,
                username: socket.user.username,
                status
            });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            this._removeActiveUser(socket.user._id, socket.id);
            this._notifyUserDisconnected(socket.user);
        });
    }

    _addActiveUser(userId, socketId) {
        if (!this.activeUsers.has(userId)) {
            this.activeUsers.set(userId, new Set());
        }
        this.activeUsers.get(userId).add(socketId);
    }

    _removeActiveUser(userId, socketId) {
        const userSockets = this.activeUsers.get(userId);
        if (userSockets) {
            userSockets.delete(socketId);
            if (userSockets.size === 0) {
                this.activeUsers.delete(userId);
            }
        }
    }

    _addUserToRoom(roomId, userId) {
        if (!this.roomUsers.has(roomId)) {
            this.roomUsers.set(roomId, new Set());
        }
        this.roomUsers.get(roomId).add(userId);
    }

    async _getActiveUsersInRoom(roomId) {
        const userIds = this.roomUsers.get(roomId) || new Set();
        const users = await User.find({ _id: { $in: Array.from(userIds) } })
            .select('username email');
        
        return users.map(user => ({
            id: user._id,
            username: user.username,
            email: user.email
        }));
    }

    _notifyUserDisconnected(user) {
        // Notify all rooms the user was in
        this.roomUsers.forEach((users, roomId) => {
            if (users.has(user._id)) {
                users.delete(user._id);
                this.io.to(roomId).emit('userLeft', {
                    userId: user._id,
                    username: user.username
                });
            }
        });
    }

    // Public methods for external use
    broadcastToCollection(collectionId, event, data) {
        const room = `collection:${collectionId}`;
        this.io.to(room).emit(event, data);
    }

    getActiveUsersInCollection(collectionId) {
        const room = `collection:${collectionId}`;
        return this._getActiveUsersInRoom(room);
    }
}

module.exports = new RealtimeService();
