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

router.post('/credits/notification', async (req, res) => {
    try {
        const {
            securityKey,
            itemNumber,
            buyerEmail,
            buyerName,
            event,
            transactionStatus
        } = req.body;

        console.log('IPN Request received:', {
            itemNumber,
            buyerEmail,
            event,
            transactionStatus
        });

        // Validate security key
        if (!await validateIPN(securityKey)) {
            console.error('Invalid security key');
            return res.status(401).json({ error: 'Invalid security key' });
        }

        let user = await User.findOne({ email: buyerEmail });
        
        // Get StickerLab and Unlimited product info
        const stickerLabVar = await Variable.findOne({ key: 'stickerLabProduct' });
        const stickerLabProductId = stickerLabVar ? stickerLabVar.value.productId : 'wso_svyh7b';
        const unlimitedProductId = 'wso_kwc43t';

        if (!user) {
            // Create a new user without a password
            if (itemNumber === stickerLabProductId || itemNumber === unlimitedProductId) {
                user = new User({
                    email: buyerEmail,
                    name: buyerName,
                    registered: false,
                    creditHistory: [{
                        product: itemNumber === unlimitedProductId ? 'StickerLab Unlimited' : 'StickerLab',
                        purchasedAt: new Date()
                    }],
                });
                if (itemNumber === unlimitedProductId) {
                    user.credits = 123654; // Unlimited credits
                    user.subscription = {
                        plan: 'unlimited',
                        status: 'active'
                    };
                }
                await user.save();
                console.log('New user created from IPN:', user.email);
            }
        } else {
            // Update existing user with purchase information
            if (itemNumber === unlimitedProductId) {
                user.credits = 123654; // Set to unlimited
                user.subscription = {
                    plan: 'unlimited',
                    status: 'active'
                };
                user.creditHistory.push({
                    product: 'StickerLab Unlimited',
                    purchasedAt: new Date()
                });
                console.log('User upgraded to Unlimited:', user.email);
            } else if (itemNumber === stickerLabProductId) {
                user.creditHistory.push({
                    product: 'StickerLab',
                    purchasedAt: new Date()
                });
                // Only add credits if not unlimited
                if (user.credits !== 123654) {
                    user.credits = (user.credits || 0) + 100;
                }
                console.log('User gained access to StickerLab:', user.email);
            } else {
                // Handle credit package purchase
                const credits = await getCreditAmount(itemNumber);
                if (credits && user.credits !== 123654) { // Only add if not unlimited
                    user.credits = (user.credits || 0) + credits;
                    user.creditHistory.push({
                        product: `Credit Purchase (${credits})`,
                        purchasedAt: new Date()
                    });
                    console.log(`Added ${credits} credits to user ${user.email}`);
                }
            }
        }

        // Check for sale event and completed status
        if (event === 'sale' && transactionStatus.toUpperCase() === 'COMPLETED') {
            await user.save();

            console.log('Transaction completed successfully:', {
                email: user.email,
                credits: user.credits,
                product: itemNumber === unlimitedProductId ? 'StickerLab Unlimited' : 
                        itemNumber === stickerLabProductId ? 'StickerLab' : 'Credits'
            });

            return res.status(200).json({
                message: 'IPN processed successfully',
                credits: user.credits
            });
        }

        return res.status(200).json({ message: 'IPN received but not processed (status not completed)' });

    } catch (error) {
        console.error('IPN Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req, res) => {
    try {
        // Debug logging
        console.log('IPN Request Body:', req.body);
        
        // Extract email and productId from various possible field names
        const email = req.body.email || req.body.buyer_email || req.body.wpyEmail;
        const productId = req.body.productId || req.body.wpy_product || req.body.wpyProduct;
        const transactionId = req.body.transactionId || req.body.wpy_id || req.body.wpyId;

        console.log('Processed fields:', {
            email,
            productId,
            transactionId
        });

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found for email:', email);
            return res.status(404).json({ error: 'User not found' });
        }

        // Load variables to get product information
        const variables = await Variable.findOne({ name: 'variables' });
        if (!variables || !variables.value) {
            console.log('Variables not found');
            return res.status(500).json({ error: 'Variables not found' });
        }

        // Check if it's the Unlimited product - check both with and without wso_ prefix
        const productIdWithoutPrefix = productId.replace('wso_', '');
        const isUnlimitedProduct = productId === 'wso_kwc43t' || 
                                 productIdWithoutPrefix === 'kwc43t' ||
                                 productId === 'kwc43t';

        console.log('Product ID check:', {
            original: productId,
            withoutPrefix: productIdWithoutPrefix,
            isUnlimited: isUnlimitedProduct
        });

        if (isUnlimitedProduct) {
            console.log('Processing unlimited upgrade for user:', email);
            
            // Update user to Unlimited plan
            user.credits = 123654; // Special number for unlimited
            user.subscription.plan = 'unlimited';
            user.subscription.status = 'active';
            
            // Add to credit history
            user.creditHistory.push({
                product: 'StickerLab Unlimited',
                credits: 123654,
                date: new Date(),
                transactionId: transactionId || 'UNLIMITED_UPGRADE'
            });

            await user.save();
            console.log('User upgraded successfully:', user);
            return res.status(200).json({ message: 'User upgraded to Unlimited plan successfully' });
        }

        // Handle regular credit products - check both with and without wso_ prefix
        const creditProduct = variables.value.creditProducts.find(p => 
            p.productId === productId || 
            p.productId.replace('wso_', '') === productIdWithoutPrefix
        );

        if (creditProduct) {
            // Add credits to user
            if (user.credits !== 123654) { // Only add if not already unlimited
                user.credits += creditProduct.credits;
            }

            // Add to credit history
            user.creditHistory.push({
                product: `Credit Purchase - ${creditProduct.credits} credits`,
                credits: creditProduct.credits,
                date: new Date(),
                transactionId: transactionId
            });

            await user.save();
            return res.status(200).json({ message: 'Credits added successfully' });
        }

        // Handle regular product purchase - check both with and without wso_ prefix
        const regularProduct = variables.value.products.find(p => 
            p.productId === productId ||
            p.productId.replace('wso_', '') === productIdWithoutPrefix
        );

        if (regularProduct) {
            user.registered = true;
            await user.save();
            return res.status(200).json({ message: 'User registered successfully' });
        }

        console.log('No matching product found for ID:', productId);
        return res.status(400).json({ error: 'Invalid product ID' });

    } catch (error) {
        console.error('IPN Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
