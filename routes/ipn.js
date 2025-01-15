const express = require('express');
const router = express.Router();
const User = require('../models/User');

const SECURITY_KEY = 'aee9d742f80584ea6b183a6b45d262b';

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
router.post('/credits/notification', async (req, res) => {
    try {
        console.log('Received IPN notification:', req.body);

        // Validate security key
        if (!validateIPN(req.body.WP_SECURITYKEY)) {
            console.error('Invalid security key');
            return res.status(401).json({ error: 'Invalid security key' });
        }

        const {
            WP_ACTION,
            WP_ITEM_NUMBER,
            WP_BUYER_EMAIL,
            WP_PAYMENT_STATUS,
            WP_SALE
        } = req.body;

        // Find user by email
        const user = await User.findOne({ email: WP_BUYER_EMAIL });
        if (!user) {
            console.error('User not found:', WP_BUYER_EMAIL);
            return res.status(404).json({ error: 'User not found' });
        }

        // Get credit amount from product ID
        const credits = CREDIT_PRODUCTS[WP_ITEM_NUMBER];
        if (!credits) {
            console.error('Invalid product ID:', WP_ITEM_NUMBER);
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        if (WP_ACTION === 'sale' && WP_PAYMENT_STATUS === 'Completed') {
            // Add credits to user's balance
            user.credits = (user.credits || 0) + credits;
            
            // Add to credit history
            if (!user.creditHistory) {
                user.creditHistory = [];
            }
            
            user.creditHistory.push({
                type: 'purchase',
                amount: credits,
                transactionId: WP_SALE,
                details: `Credit purchase via marketplace`,
                timestamp: new Date()
            });

            await user.save();

            console.log('Credits added successfully:', {
                userId: user._id,
                email: user.email,
                credits,
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
