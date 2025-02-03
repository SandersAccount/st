import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

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
        required: function() {
            // Password is only required if user has registered (not just created by IPN)
            return this.registered === true;
        }
    },
    registered: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    credits: { 
        type: mongoose.Schema.Types.Mixed, 
        default: 0,
        required: true,
        get: function(v) {
            if (v === null || v === undefined) return 0;
            return v === 123654 ? "unlimited" : v;
        },
        set: function(v) {
            if (v === null || v === undefined) return 0;
            return v === "unlimited" ? 123654 : parseInt(v) || 0;
        },
        validate: {
            validator: function(v) {
                return v !== null && v !== undefined;
            },
            message: 'Credits cannot be null or undefined'
        }
    },
    hideCredits: {
        type: Boolean,
        default: false
    },
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'pro', 'enterprise', 'basic', 'unlimited'],
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
    creditRequests: [creditRequestSchema],
    creditHistory: [{ 
        product: String,
        purchasedAt: Date
    }],
    blocked: {
        status: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String
        },
        blockedAt: {
            type: Date
        },
        blockedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Ensure credits are never null before saving
userSchema.pre('save', function(next) {
    if (this.credits === null || this.credits === undefined) {
        this.credits = 0;
    }
    next();
});

// Ensure credits are never null before updating
userSchema.pre('updateOne', function(next) {
    const update = this.getUpdate();
    if (update && (update.credits === null || update.credits === undefined)) {
        update.credits = 0;
    }
    next();
});

userSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update && (update.credits === null || update.credits === undefined)) {
        update.credits = 0;
    }
    next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

// Create the model if it hasn't been created yet
let User;
try {
    User = mongoose.model('User');
} catch {
    User = mongoose.model('User', userSchema);
}

export default User;
