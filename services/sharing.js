const Collection = require('../models/Collection');
const User = require('../models/User');
const crypto = require('crypto');

class SharingService {
    async shareCollection(collectionId, userId, options = {}) {
        try {
            const collection = await Collection.findById(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }

            // Generate unique share token if public sharing is enabled
            if (options.isPublic) {
                collection.shareToken = this._generateShareToken();
                collection.isPublic = true;
            }

            // Add collaborators
            if (options.collaborators) {
                const users = await User.find({ email: { $in: options.collaborators } });
                const collaborators = users.map(user => ({
                    userId: user._id,
                    role: options.role || 'viewer',
                    addedAt: new Date()
                }));

                // Remove duplicates
                const existingIds = collection.collaborators.map(c => c.userId.toString());
                const newCollaborators = collaborators.filter(c => 
                    !existingIds.includes(c.userId.toString())
                );

                collection.collaborators.push(...newCollaborators);

                // Send notifications to new collaborators
                await this._notifyCollaborators(collection, newCollaborators);
            }

            await collection.save();
            return collection;
        } catch (error) {
            console.error('Error sharing collection:', error);
            throw error;
        }
    }

    async updateCollaboratorRole(collectionId, userId, newRole) {
        try {
            const collection = await Collection.findById(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }

            const collaborator = collection.collaborators.find(
                c => c.userId.toString() === userId
            );

            if (!collaborator) {
                throw new Error('Collaborator not found');
            }

            collaborator.role = newRole;
            await collection.save();

            return collection;
        } catch (error) {
            console.error('Error updating collaborator role:', error);
            throw error;
        }
    }

    async removeCollaborator(collectionId, userId) {
        try {
            const collection = await Collection.findById(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }

            collection.collaborators = collection.collaborators.filter(
                c => c.userId.toString() !== userId
            );

            await collection.save();
            return collection;
        } catch (error) {
            console.error('Error removing collaborator:', error);
            throw error;
        }
    }

    async getSharedCollections(userId) {
        try {
            return await Collection.find({
                'collaborators.userId': userId
            }).populate('owner', 'username email');
        } catch (error) {
            console.error('Error getting shared collections:', error);
            throw error;
        }
    }

    async getCollectionByShareToken(token) {
        try {
            const collection = await Collection.findOne({
                shareToken: token,
                isPublic: true
            }).populate('images');

            if (!collection) {
                throw new Error('Collection not found or not public');
            }

            return collection;
        } catch (error) {
            console.error('Error getting collection by share token:', error);
            throw error;
        }
    }

    _generateShareToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    async _notifyCollaborators(collection, collaborators) {
        // Here you would implement notification logic (email, in-app, etc.)
        // For now, we'll just log it
        console.log('Notifying collaborators:', 
            collaborators.map(c => c.userId));
    }

    async checkPermission(userId, collectionId, requiredRole = 'viewer') {
        try {
            const collection = await Collection.findById(collectionId);
            if (!collection) {
                return false;
            }

            // Owner has all permissions
            if (collection.owner.toString() === userId) {
                return true;
            }

            const collaborator = collection.collaborators.find(
                c => c.userId.toString() === userId
            );

            if (!collaborator) {
                return false;
            }

            const roles = {
                viewer: 0,
                editor: 1,
                admin: 2
            };

            return roles[collaborator.role] >= roles[requiredRole];
        } catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }
}

module.exports = new SharingService();
