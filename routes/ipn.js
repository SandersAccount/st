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

// Handle IPN notifications from WarriorPlus
router.post('/notification', async (req, res) => {
    try {
        console.log('Received WarriorPlus IPN notification:', req.body);
        console.log('Incoming Request Headers:', req.headers);

        const {
            event,
            itemNumber,
            buyerEmail,
            buyerName,
            securityKey,
            transactionStatus,
            saleId
        } = req.body;

        console.log('Event:', event);
        console.log('Item Number:', itemNumber);
        console.log('Buyer Email:', buyerEmail);
        console.log('Buyer Name:', buyerName);
        console.log('Security Key:', securityKey);

        // Validate security key
        if (!await validateIPN(securityKey)) {
            console.error('Invalid security key');
            return res.status(401).json({ error: 'Invalid security key' });
        }

        let user = await User.findOne({ email: buyerEmail });
        
        // Get StickerLab product info
        const stickerLabVar = await Variable.findOne({ key: 'stickerLabProduct' });
        const stickerLabProductId = stickerLabVar ? stickerLabVar.value.productId : 'wso_svyh7b';

        if (!user) {
            // Create a new user without a password
            if (itemNumber === stickerLabProductId) {
                user = new User({
                    email: buyerEmail,
                    name: buyerName,
                    registered: false,
                    creditHistory: [{ product: 'StickerLab', purchasedAt: new Date() }],
                });
                await user.save();
                console.log('New user created from IPN:', user.email);
            }
        } else {
            // Update existing user with purchase information
            if (itemNumber === stickerLabProductId) {
                user.creditHistory.push({ product: 'StickerLab', purchasedAt: new Date() });
            }
        }

        // Handle credit assignment
        if (itemNumber === stickerLabProductId) {
            // Logic for handling StickerLab purchase
            user.credits = (user.credits || 0) + 100;
            console.log('User gained access to StickerLab and received 100 credits:', user.email);
        } else {
            // Handle credit package purchase
            const credits = await getCreditAmount(itemNumber);
            if (credits) {
                user.credits = (user.credits || 0) + credits;
                user.creditHistory.push({
                    product: `Credit Purchase (${credits})`,
                    purchasedAt: new Date()
                });
                console.log(`Added ${credits} credits to user ${user.email}`);
            }
        }

        // Check for sale event and completed status
        if (event === 'sale' && transactionStatus.toUpperCase() === 'COMPLETED') {
            await user.save();

            console.log('Credits added successfully:', {
                userId: user._id,
                email: user.email,
                credits: user.credits,
                newBalance: user.credits,
                transactionId: saleId
            });

            res.json({
                message: 'Credits added successfully',
                userId: user._id,
                credits: user.credits
            });
        } else {
            console.log('Unhandled IPN event or status:', { event, transactionStatus });
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
