import express from 'express';
import User from '../models/User.js';
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
            '/stats': 'Get system statistics',
            '/credits/approve/:requestId': 'Approve credit request'
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
        const { role, subscription, credits } = req.body;
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
        if (credits !== undefined) {
            user.credits = credits;
        }

        await user.save();
        console.log('User updated');
        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Approve credit request
router.post('/credits/approve/:requestId', [auth, adminAuth], async (req, res) => {
    try {
        console.log('Processing credit request approval:', req.params.requestId);
        
        if (!req.params.requestId) {
            console.log('No request ID provided');
            return res.status(400).json({ error: 'Request ID is required' });
        }

        // Find the user with the credit request
        const user = await User.findOne({
            'creditRequests._id': req.params.requestId
        });

        if (!user) {
            console.log('Credit request not found');
            return res.status(404).json({ error: 'Credit request not found' });
        }

        // Find the specific credit request
        const creditRequest = user.creditRequests.find(
            req => req._id.toString() === req.params.requestId
        );
        
        if (!creditRequest) {
            console.log('Credit request not found in user document');
            return res.status(404).json({ error: 'Credit request not found' });
        }

        if (creditRequest.status !== 'pending') {
            console.log('Credit request already processed');
            return res.status(400).json({ error: 'Credit request already processed' });
        }

        // Update credit request status
        creditRequest.status = 'approved';
        creditRequest.approvedAt = new Date();
        creditRequest.approvedBy = req.user._id;

        // Add credits to user's account
        const currentCredits = user.credits || 0;
        const requestedCredits = creditRequest.credits || 0;
        user.credits = currentCredits + requestedCredits;

        console.log('Updating user credits:', {
            userId: user._id,
            currentCredits,
            requestedCredits,
            newTotal: user.credits
        });

        // Mark the credit request as modified
        user.markModified('creditRequests');
        
        await user.save();
        console.log('Credit request approved successfully');

        res.json({
            message: 'Credit request approved successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                credits: user.credits,
                creditRequest: {
                    id: creditRequest._id,
                    status: creditRequest.status,
                    credits: creditRequest.credits,
                    approvedAt: creditRequest.approvedAt
                }
            }
        });
    } catch (error) {
        console.error('Credit approval error:', error);
        res.status(500).json({ error: 'Failed to approve credits: ' + error.message });
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

        // Get total users
        const totalUsers = usersByRole.reduce((acc, curr) => acc + curr.count, 0);

        // Get subscription stats with default values
        const subscriptionStats = await User.aggregate([
            {
                $group: {
                    _id: { 
                        plan: { $ifNull: ['$subscription.plan', 'free'] },
                        status: { $ifNull: ['$subscription.status', 'active'] }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.plan',
                    count: { $sum: '$count' },
                    active: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.status', 'active'] }, '$count', 0]
                        }
                    }
                }
            }
        ]);

        // Get credit stats
        const creditStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalCredits: { $sum: { $ifNull: ['$credits', 0] } },
                    totalUsers: { $sum: 1 }
                }
            }
        ]);

        // Get credit request stats
        const creditRequestStats = await User.aggregate([
            {
                $unwind: {
                    path: '$creditRequests',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: { $ifNull: ['$creditRequests.status', 'none'] },
                    count: { $sum: 1 },
                    totalCredits: { 
                        $sum: { 
                            $ifNull: ['$creditRequests.credits', 0] 
                        } 
                    }
                }
            }
        ]);

        console.log('Statistics fetched successfully');
        
        res.json({
            users: {
                byRole: usersByRole,
                total: totalUsers
            },
            subscriptions: subscriptionStats.map(stat => ({
                ...stat,
                _id: stat._id || 'free',
                count: stat.count || 0,
                active: stat.active || 0
            })),
            credits: {
                total: creditStats[0]?.totalCredits || 0,
                average: creditStats[0] ? creditStats[0].totalCredits / creditStats[0].totalUsers : 0
            },
            creditRequests: creditRequestStats.map(stat => ({
                ...stat,
                _id: stat._id || 'none',
                count: stat.count || 0,
                totalCredits: stat.totalCredits || 0
            }))
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
