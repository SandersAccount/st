import express from 'express';
import User from '../models/user.js';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// Root endpoint
router.get('/', [auth, adminAuth], async (req, res) => {
    res.json({
        message: 'Admin API',
        endpoints: {
            '/users': 'Get all users (with pagination)',
            '/users/:userId': 'Get user details',
            '/users/:userId': 'Update user',
            '/stats': 'Get system statistics'
        }
    });
});

// Get all users (with pagination and filters)
router.get('/users', [auth, adminAuth], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.plan) filter['subscription.plan'] = req.query.plan;
        if (req.query.status) filter['subscription.status'] = req.query.status;

        console.log('Fetching users with filter:', filter);

        const users = await User.find(filter)
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(filter);

        console.log(`Found ${total} users`);

        res.json({
            users,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user details
router.get('/users/:userId', [auth, adminAuth], async (req, res) => {
    try {
        console.log('Fetching user details for user ID:', req.params.userId);
        const user = await User.findById(req.params.userId).select('-password');
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('User found');
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user
router.put('/users/:userId', [auth, adminAuth], async (req, res) => {
    try {
        console.log('Updating user with ID:', req.params.userId);
        const { role, subscription } = req.body;
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        if (role) user.role = role;
        if (subscription) {
            user.subscription = {
                ...user.subscription,
                ...subscription
            };
        }

        await user.save();
        console.log('User updated');
        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user status
router.put('/users/:userId/status', [auth, adminAuth], async (req, res) => {
    try {
        console.log('Updating user status:', {
            userId: req.params.userId,
            updates: req.body
        });

        const { role, subscription } = req.body;
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        // Update role if provided
        if (role && ['user', 'admin'].includes(role)) {
            user.role = role;
        }

        // Update subscription if provided
        if (subscription) {
            if (subscription.plan) {
                user.subscription.plan = subscription.plan;
            }
            if (subscription.status) {
                user.subscription.status = subscription.status;
            }
        }

        await user.save();
        console.log('User updated successfully');
        
        res.json({
            message: 'User updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                subscription: user.subscription
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get system statistics
router.get('/stats', [auth, adminAuth], async (req, res) => {
    try {
        console.log('Fetching system statistics');

        // Get user counts by role
        const usersByRole = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get subscription stats
        const subscriptionStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription.plan',
                    count: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $eq: ['$subscription.status', 'active'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Get total image generations
        const totalGenerations = await User.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$usage.imagesGenerated' }
                }
            }
        ]);

        console.log('Statistics fetched successfully');
        
        res.json({
            users: {
                byRole: usersByRole,
                total: usersByRole.reduce((acc, curr) => acc + curr.count, 0)
            },
            subscriptions: subscriptionStats,
            usage: {
                totalGenerations: totalGenerations[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
