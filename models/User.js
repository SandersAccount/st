import bcrypt from 'bcryptjs';
import mongoose from '../config/database.js';

const creditRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    credits: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    approvedAt: Date,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const creditHistorySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['add', 'use'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    details: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    nickname: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        trim: true
    },
    credits: {
        type: Number,
        default: 100,  // Initial credits for new users
        min: 0  // Prevent negative credits
    },
    creditHistory: [creditHistorySchema],
    creditRequests: [creditRequestSchema],
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'pro', 'enterprise'],
            default: 'free'
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'cancelled'],
            default: 'active'
        },
        startDate: Date,
        endDate: Date
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

// Create the model if it hasn't been created yet
let User;
try {
    User = mongoose.model('User');
} catch (error) {
    User = mongoose.model('User', userSchema);
}

export default User;
