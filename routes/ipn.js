import express from 'express';
import User from '../models/User.js';

const SECURITY_KEY = '4350c564f7cef14a92c7ff7ff9c6dce';

// Helper function to validate IPN request
function validateIPN(securityKey) {
    return securityKey === SECURITY_KEY;
}

// Map product IDs to credit amounts
const CREDIT_PRODUCTS = {
    'product_100': 100,
    'product_200': 200,
    'product_300': 300,
    'product_400': 400,
    'product_500': 500,
    'product_600': 600,
    'product_700': 700,
    'product_800': 800,
    'product_900': 900,
    'product_1000': 1000,
};

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
            // Create a new user if not found
            if (WP_ITEM_NUMBER === 'wso_svyh7b') { // StickerLab product code
                user = new User({
                    email: WP_BUYER_EMAIL,
                    name: WP_BUYER_NAME,
                    password: 'defaultPassword', // Set a default password or handle as needed
                    // Add other necessary fields
                });
            } else {
                user = new User({
                    email: WP_BUYER_EMAIL,
                    // Add other necessary fields, like a default password or username
                });
            }
            await user.save();
            console.log('New user created:', user);
        }

        if (WP_ITEM_NUMBER === 'wso_svyh7b') {
            // Logic for handling StickerLab purchase
            user.credits = (user.credits || 0) + 100; // Add 100 credits
            console.log('User gained access to StickerLab and received 100 credits:', user.email);
        } else if (WP_ITEM_NUMBER.startsWith('product_')) {
            const credits = CREDIT_PRODUCTS[WP_ITEM_NUMBER];
            if (credits) {
                // Add credits to user's balance
                user.credits = (user.credits || 0) + credits;
                console.log('Credits added:', credits);
            }
        }

        if (WP_ACTION === 'sale' && WP_PAYMENT_STATUS === 'Completed') {
            // Add to credit history
            if (!user.creditHistory) {
                user.creditHistory = [];
            }
            
            user.creditHistory.push({
                type: 'purchase',
                amount: user.credits,
                transactionId: WP_SALE,
                details: `Credit purchase via marketplace`,
                timestamp: new Date()
            });

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
        } else if (WP_ACTION === 'refund') {
            // Handle refund
            // Find the original purchase in credit history
            const purchase = user.creditHistory.find(h => 
                h.transactionId === WP_SALE && h.type === 'purchase'
            );

            if (purchase) {
                // Remove credits
                user.credits = Math.max(0, (user.credits || 0) - purchase.amount);
                
                // Add refund to history
                user.creditHistory.push({
                    type: 'refund',
                    amount: -purchase.amount,
                    transactionId: WP_SALE,
                    details: `Credit purchase refunded`,
                    timestamp: new Date()
                });

                await user.save();

                console.log('Credits refunded successfully:', {
                    userId: user._id,
                    email: user.email,
                    credits: -purchase.amount,
                    newBalance: user.credits,
                    transactionId: WP_SALE
                });

                res.json({
                    message: 'Credits refunded successfully',
                    userId: user._id,
                    credits: user.credits
                });
            } else {
                console.error('Original purchase not found:', WP_SALE);
                res.status(404).json({ error: 'Original purchase not found' });
            }
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
