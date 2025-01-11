import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    coverImage: {
        type: String
    },
    images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Generation'
    }],
    isPublic: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        trim: true
    }],
    stats: {
        viewCount: {
            type: Number,
            default: 0
        },
        imageCount: {
            type: Number,
            default: 0
        },
        lastModified: {
            type: Date,
            default: Date.now
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Update stats.imageCount when images are modified
collectionSchema.pre('save', function(next) {
    if (this.isModified('images')) {
        this.stats.imageCount = this.images.length;
        this.stats.lastModified = new Date();
    }
    next();
});

const Collection = mongoose.model('Collection', collectionSchema);
export default Collection;
