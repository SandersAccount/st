import mongoose from 'mongoose';

const generationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    settings: {
        type: Object,
        default: {}
    },
    collectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
generationSchema.index({ userId: 1, timestamp: -1 });

const Generation = mongoose.model('Generation', generationSchema);
export default Generation;
