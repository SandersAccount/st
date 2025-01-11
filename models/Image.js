const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    prompt: {
        type: String,
        trim: true
    },
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }],
    category: {
        type: String,
        enum: ['sticker', 'emoji', 'avatar', 'background', 'other'],
        default: 'sticker'
    },
    metadata: {
        width: Number,
        height: Number,
        format: String,
        size: Number // in bytes
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create indexes for search
ImageSchema.index({ prompt: 'text' });
ImageSchema.index({ category: 1 });
ImageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Image', ImageSchema);
