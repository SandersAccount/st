const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    collaborators: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['viewer', 'editor', 'admin'],
            default: 'viewer'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isPublic: {
        type: Boolean,
        default: false
    },
    shareToken: {
        type: String,
        unique: true,
        sparse: true
    },
    settings: {
        allowComments: {
            type: Boolean,
            default: true
        },
        allowDuplicates: {
            type: Boolean,
            default: false
        },
        sortOrder: {
            type: String,
            enum: ['recent', 'name', 'size'],
            default: 'recent'
        }
    },
    stats: {
        viewCount: {
            type: Number,
            default: 0
        },
        downloadCount: {
            type: Number,
            default: 0
        },
        lastViewed: Date,
        lastModified: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Create text index for search
CollectionSchema.index({ title: 'text', description: 'text' });

// Update timestamps
CollectionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Update stats on view
CollectionSchema.methods.recordView = async function() {
    this.stats.viewCount++;
    this.stats.lastViewed = new Date();
    await this.save();
};

// Check if user has permission
CollectionSchema.methods.hasPermission = function(userId, requiredRole = 'viewer') {
    if (this.owner.toString() === userId.toString()) {
        return true;
    }

    const collaborator = this.collaborators.find(
        c => c.userId.toString() === userId.toString()
    );

    if (!collaborator) {
        return this.isPublic && requiredRole === 'viewer';
    }

    const roles = {
        viewer: 0,
        editor: 1,
        admin: 2
    };

    return roles[collaborator.role] >= roles[requiredRole];
};

module.exports = mongoose.model('Collection', CollectionSchema);
