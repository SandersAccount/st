import express from 'express';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import subscriptionService from '../services/subscription.js';
import plans from '../config/plans.js';
import Stripe from 'stripe';

const router = express.Router();

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Root endpoint
router.get('/', auth, async (req, res) => {
    res.json({
        message: 'Subscription API',
        endpoints: {
            '/plans': 'Get available plans',
            '/current': 'Get current subscription',
            '/subscribe/:planId': 'Subscribe to a plan',
            '/cancel': 'Cancel subscription'
        }
    });
});

// Get available plans
router.get('/plans', (req, res) => {
    res.json(plans);
});

// Get current subscription
router.get('/current', auth, async (req, res) => {
    try {
        const user = req.user;
        res.json({
            plan: user.subscription.plan,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Subscribe to a plan
router.post('/subscribe/:planId', auth, async (req, res) => {
    try {
        const { planId } = req.params;
        const plan = plans.find(p => p.id === planId);
        
        if (!plan) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const subscription = await subscriptionService.createSubscription(req.user, planId);
        res.json(subscription);
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ error: 'Subscription failed' });
    }
});

// Cancel subscription
router.post('/cancel', auth, async (req, res) => {
    try {
        const subscription = await subscriptionService.cancelSubscription(req.user);
        res.json(subscription);
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Cancellation failed' });
    }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        await subscriptionService.handleWebhook(event);
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: error.message });
    }
});

export default router;
