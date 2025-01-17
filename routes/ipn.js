import express from 'express';
import User from '../models/User.js';
import { creditProducts } from '../config/credits.js';

const SECURITY_KEY = '4350c564f7cef14a92c7ff7ff9c6dce';

// Helper function to validate IPN request
function validateIPN(securityKey) {
    return securityKey === SECURITY_KEY;
}

// Map product IDs to credit amounts
const CREDIT_PRODUCTS = creditProducts.reduce((acc, product) => {
    acc[product.productId] = product.credits;
    return acc;
}, {});

// Handle IPN notifications
const router = express.Router();
router.post('/credits/notification', async (req, res) => {
    try {
        console.log('Received IPN notification:', req.body);
        console.log('Incoming Request Headers:', req.headers);

        const {
            WP_ACTION,
            WP_ITEM_NUMBER,
            WP_BUYER_EMAIL,
            WP_BUYER_NAME,
            WP_SECURITYKEY,
            WP_PAYMENT_STATUS,
            WP_SALE
        } = req.body;

        console.log('WP_ACTION:', WP_ACTION);
        console.log('WP_ITEM_NUMBER:', WP_ITEM_NUMBER);
        console.log('WP_BUYER_EMAIL:', WP_BUYER_EMAIL);
        console.log('WP_BUYER_NAME:', WP_BUYER_NAME);
        console.log('WP_SECURITYKEY:', WP_SECURITYKEY);

        // Validate security key
        if (!validateIPN(WP_SECURITYKEY)) {
            console.error('Invalid security key');
            return res.status(401).json({ error: 'Invalid security key' });
        }

        let user = await User.findOne({ email: WP_BUYER_EMAIL });
        if (!user) {
            // Create a new user without a password
            if (WP_ITEM_NUMBER === 'wso_svyh7b') { // StickerLab product code
                user = new User({
                    email: WP_BUYER_EMAIL,
                    name: WP_BUYER_NAME,
                    registered: false, // Mark as not registered yet
                    creditHistory: [{ product: 'StickerLab', purchasedAt: new Date() }],
                });
                await user.save(); // Save the new user immediately
                console.log('New user created from IPN:', user.email);
            }
        } else {
            // Update existing user with purchase information
            if (WP_ITEM_NUMBER === 'wso_svyh7b') {
                user.creditHistory.push({ product: 'StickerLab', purchasedAt: new Date() });
            }
        }

        // Handle credit assignment
        if (WP_ITEM_NUMBER === 'wso_svyh7b') {
            // Logic for handling StickerLab purchase
            user.credits = (user.credits || 0) + 100; // Add 100 credits
            console.log('User gained access to StickerLab and received 100 credits:', user.email);
        } else if (CREDIT_PRODUCTS[WP_ITEM_NUMBER]) {
            // Handle credit package purchase
            const credits = CREDIT_PRODUCTS[WP_ITEM_NUMBER];
            user.credits = (user.credits || 0) + credits;
            user.creditHistory.push({
                product: `Credit Purchase (${credits})`,
                purchasedAt: new Date()
            });
            console.log(`Added ${credits} credits to user ${user.email}`);
        }

        // Case-insensitive status check
        if (WP_ACTION === 'sale' && WP_PAYMENT_STATUS.toUpperCase() === 'COMPLETED') {
            await user.save();

            console.log('Credits added successfully:', {
                userId: user._id,
                email: user.email,
                credits: user.credits,
                newBalance: user.credits,
                transactionId: WP_SALE
            });

            res.json({
                message: 'Credits added successfully',
                userId: user._id,
                credits: user.credits
            });
        } else {
            console.log('Unhandled IPN action or status:', { WP_ACTION, WP_PAYMENT_STATUS });
            res.json({ message: 'Notification received but no action taken' });
        }
    } catch (error) {
        console.error('Error processing IPN:', error);
        res.status(500).json({ 
            error: 'Failed to process IPN notification',
            details: error.message
        });
    }
});

export default router;
