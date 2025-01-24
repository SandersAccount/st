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

// Get admin stats
router.get('/stats', [auth, adminAuth], async (req, res) => {
    try {
        // Get total users
        const totalUsers = await User.countDocuments();
        
        // Get pro users
        const proUsers = await User.countDocuments({
            'subscription.plan': 'pro',
            'subscription.status': 'active'
        });

        // Get total credits
        const creditsResult = await User.aggregate([
            { $group: { _id: null, total: { $sum: '$credits' } } }
        ]);
        const totalCredits = creditsResult[0]?.total || 0;

        // Get pending credits
        const pendingResult = await User.aggregate([
            { $unwind: '$creditRequests' },
            { $match: { 'creditRequests.status': 'pending' } },
            { $group: { _id: null, total: { $sum: '$creditRequests.credits' } } }
        ]);
        const pendingCredits = pendingResult[0]?.total || 0;

        // Get total stickers
        const stickersResult = await User.aggregate([
            { $group: { _id: null, total: { $sum: '$usage.imagesGenerated' } } }
        ]);
        const totalStickers = stickersResult[0]?.total || 0;

        // Get total presets
        const presetsResult = await User.aggregate([
            { $group: { _id: null, total: { $sum: '$usage.savedPresets' } } }
        ]);
        const totalPresets = presetsResult[0]?.total || 0;

        res.json({
            users: {
                total: totalUsers,
                pro: proUsers
            },
            credits: {
                total: totalCredits,
                pending: pendingCredits
            },
            stickers: {
                total: totalStickers
            },
            presets: {
                total: totalPresets
            }
        });
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Failed to get admin stats' });
    }
});

// Get all users
router.get('/users', [auth, adminAuth], async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort('-createdAt');
        
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
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
        const { userId } = req.params;
        const { name, email, password, credits } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow editing admin user through this endpoint
        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Cannot edit admin user through this endpoint' });
        }

        // Update user fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (password) user.password = password; // Will be hashed by the User model middleware
        if (credits !== undefined) user.credits = credits;

        await user.save();

        res.json({
            message: 'User updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                credits: user.credits,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/users/:userId', [auth, adminAuth], async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow deleting admin user
        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin user' });
        }

        await User.findByIdAndDelete(userId);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
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

// Create test user
router.post('/users/create', [auth, adminAuth], async (req, res) => {
    try {
        const { name, email, password, credits, registered, role, subscription, creditHistory, usage } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password, // Will be hashed by the User model middleware
            credits,
            registered,
            role,
            subscription,
            creditHistory,
            usage,
            createdAt: new Date(),
            lastLogin: new Date()
        });

        await user.save();

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                credits: user.credits,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

router.post('/register', async (req, res) => {
    const { email, password, name } = req.body; // Include name in the registration data

    // Check if the email was used to purchase StickerLab
    const stickerLabPurchase = await User.findOne({ email: email, 'creditHistory.product': 'StickerLab' });

    // If the email does not correspond to a purchase, return an error
    if (!stickerLabPurchase) {
        return res.status(400).json({ error: 'Please, register with the same email that you used to purchase the StickerLab.' });
    }

    // If the user already exists, allow registration without alerts
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        // If the user exists, we can allow registration without alerts
        existingUser.name = name; // Update the name if needed
        await existingUser.save();
        return res.status(200).json({ message: 'Registration successful!' });
    }

    // Create the new user with the provided name
    const newUser = new User({
        email,
        name, // Allow the user to set their name
        password, // Hash the password as needed
    });
    await newUser.save();
    res.status(201).json({ message: 'Registration successful!' });
});

// Block/Unblock user
router.post('/users/:userId/block', [auth, adminAuth], async (req, res) => {
    try {
        const { userId } = req.params;
        const { blocked, reason } = req.body;
        const adminId = req.user._id; // Get admin ID from auth middleware

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow blocking admin users
        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Cannot block admin users' });
        }

        // Update blocked status
        user.blocked = {
            status: blocked,
            reason: blocked ? reason : null,
            blockedAt: blocked ? new Date() : null,
            blockedBy: blocked ? adminId : null
        };

        await user.save();

        res.json({
            message: `User ${blocked ? 'blocked' : 'unblocked'} successfully`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                credits: user.credits,
                role: user.role,
                blocked: user.blocked
            }
        });
    } catch (error) {
        console.error('Error updating user block status:', error);
        res.status(500).json({ error: 'Failed to update user block status' });
    }
});

export default router;
