import Stripe from 'stripe';
import User from '../../models/User.js';
import plans from '../../config/plans.js';

let stripe;
try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} catch (error) {
    console.warn('Stripe initialization failed. Running in development mode without Stripe.');
    stripe = null;
}

class SubscriptionService {
    async createCustomer(user) {
        if (!stripe) {
            console.warn('Stripe not initialized. Skipping customer creation.');
            return null;
        }

        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                userId: user._id.toString()
            }
        });
        
        user.subscription.stripeCustomerId = customer.id;
        await user.save();
        
        return customer;
    }

    async createSubscription(user, planId) {
        try {
            const plan = plans.find(p => p.id === planId);
            if (!plan) {
                throw new Error('Invalid plan');
            }

            if (!stripe) {
                // In development, just update the user's subscription without Stripe
                user.subscription.plan = planId;
                user.subscription.status = 'active';
                user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
                await user.save();
                return { id: 'dev_subscription', status: 'active' };
            }

            if (!user.subscription.stripeCustomerId) {
                await this.createCustomer(user);
            }

            const subscription = await stripe.subscriptions.create({
                customer: user.subscription.stripeCustomerId,
                items: [{ price: process.env.STRIPE_PRO_PRICE_ID }],
                expand: ['latest_invoice.payment_intent']
            });

            user.subscription.stripeSubscriptionId = subscription.id;
            user.subscription.plan = planId;
            user.subscription.status = 'active';
            user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            
            await user.save();

            return subscription;
        } catch (error) {
            console.error('Subscription creation error:', error);
            throw error;
        }
    }

    async cancelSubscription(user) {
        try {
            if (!stripe) {
                // In development, just update the user's subscription without Stripe
                user.subscription.status = 'cancelled';
                user.subscription.plan = 'free';
                await user.save();
                return { id: 'dev_subscription', status: 'cancelled' };
            }

            if (!user.subscription.stripeSubscriptionId) {
                throw new Error('No active subscription found');
            }

            const subscription = await stripe.subscriptions.del(
                user.subscription.stripeSubscriptionId
            );

            user.subscription.status = 'cancelled';
            user.subscription.plan = 'free';
            await user.save();

            return subscription;
        } catch (error) {
            console.error('Subscription cancellation error:', error);
            throw error;
        }
    }

    async handleWebhook(event) {
        if (!stripe) {
            console.warn('Stripe not initialized. Skipping webhook handling.');
            return;
        }

        try {
            switch (event.type) {
                case 'customer.subscription.deleted':
                    const subscription = event.data.object;
                    const user = await User.findOne({
                        'subscription.stripeSubscriptionId': subscription.id
                    });
                    
                    if (user) {
                        user.subscription.status = 'cancelled';
                        user.subscription.plan = 'free';
                        await user.save();
                    }
                    break;

                case 'customer.subscription.updated':
                    const updatedSubscription = event.data.object;
                    const updatedUser = await User.findOne({
                        'subscription.stripeSubscriptionId': updatedSubscription.id
                    });
                    
                    if (updatedUser) {
                        updatedUser.subscription.currentPeriodEnd = 
                            new Date(updatedSubscription.current_period_end * 1000);
                        await updatedUser.save();
                    }
                    break;
            }
        } catch (error) {
            console.error('Webhook handling error:', error);
            throw error;
        }
    }
}

export default new SubscriptionService();
