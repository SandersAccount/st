import express from 'express';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import mongoose from '../config/database.js';

const router = express.Router();

// Request credits purchase
router.post('/request', auth, async (req, res) => {
    try {
        const { credits } = req.body;
        console.log('Received credit request:', { userId: req.user._id, credits });
        
        if (!credits || credits < 100 || credits > 1000 || credits % 100 !== 0) {
            return res.status(400).json({ error: 'Invalid credits amount' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create credit request record
        const creditRequest = {
            userId: user._id,
            credits: credits,
            status: 'pending',
            requestedAt: new Date()
        };

        // Initialize creditRequests array if it doesn't exist
        if (!user.creditRequests) {
            user.creditRequests = [];
        }

        console.log('Creating credit request:', creditRequest);
        user.creditRequests.push(creditRequest);
        await user.save();

        res.json({ 
            message: 'Credit request submitted successfully',
            request: creditRequest
        });
    } catch (error) {
        console.error('Error in /request:', error);
        res.status(500).json({ 
            error: 'Failed to request credits',
            details: error.message
        });
    }
});

// Get credit history
router.get('/history', auth, async (req, res) => {
    try {
        console.log('Fetching credit history for user:', req.user._id);
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize credit history if it doesn't exist
        if (!user.creditHistory) {
            user.creditHistory = [];
            await user.save();
        }

        // Combine credit history and credit requests
        const history = [
            ...(user.creditHistory || []).map(item => ({
                type: item.type,
                amount: item.amount,
                details: item.details,
                timestamp: item.timestamp,
                status: 'completed'
            })),
            ...(user.creditRequests || []).map(req => ({
                type: 'purchase',
                amount: req.credits,
                details: `Credit purchase request`,
                timestamp: req.requestedAt,
                status: req.status
            }))
        ];

        // Sort by timestamp, most recent first
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`Found ${history.length} history items`);
        res.json(history);
    } catch (error) {
        console.error('Error fetching credit history:', error);
        res.status(500).json({ error: 'Failed to fetch credit history' });
    }
});

// Admin: Get all credit requests
router.get('/requests', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        console.log('Fetching credit requests for admin:', req.user._id);

        const users = await User.find({ 'creditRequests.status': 'pending' })
            .select('_id name email creditRequests');

        console.log('Found users with pending requests:', users.length);

        const requests = [];
        users.forEach(user => {
            const pendingRequests = (user.creditRequests || []).filter(req => req.status === 'pending');
            console.log(`User ${user._id} has ${pendingRequests.length} pending requests`);
            
            pendingRequests.forEach(req => {
                requests.push({
                    _id: req._id.toString(),
                    userId: user._id.toString(),
                    userName: user.name,
                    userEmail: user.email,
                    credits: req.credits,
                    requestedAt: req.requestedAt,
                    status: req.status
                });
            });
        });

        // Sort by request date, most recent first
        requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

        console.log('Returning requests:', requests);
        res.json(requests);
    } catch (error) {
        console.error('Error in /requests:', error);
        res.status(500).json({ 
            error: 'Failed to get credit requests',
            details: error.message
        });
    }
});

// Admin: Approve credit request
router.post('/approve/:requestId', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const requestId = req.params.requestId;
        if (!requestId) {
            return res.status(400).json({ error: 'Request ID is required' });
        }

        console.log('Processing credit request approval:', requestId);

        // Find user with this credit request
        const user = await User.findOne({
            'creditRequests._id': requestId
        });

        if (!user) {
            console.log('Credit request not found');
            return res.status(404).json({ error: 'Credit request not found' });
        }

        // Find the specific credit request
        const creditRequest = user.creditRequests.find(
            req => req._id.toString() === requestId
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

        // Add to credit history
        if (!user.creditHistory) {
            user.creditHistory = [];
        }

        user.creditHistory.push({
            type: 'purchase',
            amount: requestedCredits,
            details: `Credit purchase approved by admin`,
            timestamp: new Date()
        });

        console.log('Updating user credits:', {
            userId: user._id,
            currentCredits,
            requestedCredits,
            newTotal: user.credits
        });

        // Mark modified arrays
        user.markModified('creditRequests');
        user.markModified('creditHistory');

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

export default router;
