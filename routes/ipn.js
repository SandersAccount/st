import express from 'express';
import User from '../models/User.js';
import Variable from '../models/Variable.js';

const router = express.Router();

// Get security key from variables
async function getSecurityKey() {
    const securityVar = await Variable.findOne({ key: 'securityKey' });
    return securityVar ? securityVar.value : '4350c564f7cef14a92c7ff7ff9c6dce';
}

// Get credit amount for a product
async function getCreditAmount(productId) {
    const creditProducts = await Variable.findOne({ key: 'creditProducts' });
    if (!creditProducts) return null;

    const product = creditProducts.value.find(p => p.productId === productId);
    return product ? product.credits : null;
}

// Validate IPN request
async function validateIPN(securityKey) {
    const validKey = await getSecurityKey();
    return securityKey === validKey;
}

// Handle IPN notifications
router.post('/notification', async (req, res) => {
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
        if (!await validateIPN(WP_SECURITYKEY)) {
            console.error('Invalid security key');
            return res.status(401).json({ error: 'Invalid security key' });
        }

        let user = await User.findOne({ email: WP_BUYER_EMAIL });
        
        // Get StickerLab product info
        const stickerLabVar = await Variable.findOne({ key: 'stickerLabProduct' });
        const stickerLabProductId = stickerLabVar ? stickerLabVar.value.productId : 'wso_svyh7b';

        if (!user) {
            // Create a new user without a password
            if (WP_ITEM_NUMBER === stickerLabProductId) {
                user = new User({
                    email: WP_BUYER_EMAIL,
                    name: WP_BUYER_NAME,
                    registered: false,
                    creditHistory: [{ product: 'StickerLab', purchasedAt: new Date() }],
                });
                await user.save();
                console.log('New user created from IPN:', user.email);
            }
        } else {
            // Update existing user with purchase information
            if (WP_ITEM_NUMBER === stickerLabProductId) {
                user.creditHistory.push({ product: 'StickerLab', purchasedAt: new Date() });
            }
        }

        // Handle credit assignment
        if (WP_ITEM_NUMBER === stickerLabProductId) {
            // Logic for handling StickerLab purchase
            user.credits = (user.credits || 0) + 100;
            console.log('User gained access to StickerLab and received 100 credits:', user.email);
        } else {
            // Handle credit package purchase
            const credits = await getCreditAmount(WP_ITEM_NUMBER);
            if (credits) {
                user.credits = (user.credits || 0) + credits;
                user.creditHistory.push({
                    product: `Credit Purchase (${credits})`,
                    purchasedAt: new Date()
                });
                console.log(`Added ${credits} credits to user ${user.email}`);
            }
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
