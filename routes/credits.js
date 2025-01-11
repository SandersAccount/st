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
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user.creditHistory.sort((a, b) => b.timestamp - a.timestamp));
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
            const pendingRequests = user.creditRequests.filter(req => req.status === 'pending');
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
router.post('/approve/:userId', auth, async (req, res) => {
    try {
        console.log('Received approval request:', {
            adminId: req.user._id,
            userId: req.params.userId,
            requestData: req.body
        });

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { userId } = req.params;
        const { requestId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const request = user.creditRequests.id(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Credit request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Credit request is not pending' });
        }

        // Update request status
        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = req.user._id;

        // Add credits and record in history
        const creditsToAdd = request.credits;
        user.credits += creditsToAdd;
        user.creditHistory.push({
            type: 'add',
            amount: creditsToAdd,
            details: `Credit purchase approved by admin`
        });

        await user.save();
        res.json({ 
            message: 'Credits approved successfully',
            updatedCredits: user.credits
        });
    } catch (error) {
        console.error('Error in /approve:', error);
        res.status(500).json({ error: 'Failed to approve credits' });
    }
});

export default router;
