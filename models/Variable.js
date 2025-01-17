import mongoose from 'mongoose';

const variableSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['security', 'products', 'urls', 'credits']
    },
    description: {
        type: String,
        required: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

const Variable = mongoose.model('Variable', variableSchema);

export default Variable;
