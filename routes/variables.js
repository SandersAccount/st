import express from 'express';
import Variable from '../models/Variable.js';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const router = express.Router();

// Get all variables
router.get('/', auth, adminAuth, async (req, res) => {
    try {
        const variables = await Variable.find().sort({ category: 1, key: 1 });
        res.json(variables);
    } catch (error) {
        console.error('Error getting variables:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get variables by category
router.get('/category/:category', auth, adminAuth, async (req, res) => {
    try {
        const variables = await Variable.find({ category: req.params.category }).sort({ key: 1 });
        res.json(variables);
    } catch (error) {
        console.error('Error getting variables by category:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update variable
router.put('/:id', auth, adminAuth, async (req, res) => {
    try {
        console.log('Updating variable:', req.params.id);
        console.log('New value:', req.body.value);

        const { value } = req.body;
        if (value === undefined) {
            return res.status(400).json({ error: 'Value is required' });
        }

        const variable = await Variable.findByIdAndUpdate(
            req.params.id,
            { 
                value,
                lastUpdated: new Date()
            },
            { new: true }
        );
        
        if (!variable) {
            console.error('Variable not found:', req.params.id);
            return res.status(404).json({ error: 'Variable not found' });
        }

        console.log('Variable updated successfully:', variable);
        res.json(variable);
    } catch (error) {
        console.error('Error updating variable:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

// Initialize default variables if they don't exist
export async function initializeVariables() {
    const defaultVariables = [
        {
            key: 'securityKey',
            value: '4350c564f7cef14a92c7ff7ff9c6dce',
            category: 'security',
            description: 'Security key for IPN validation'
        },
        {
            key: 'salesPage',
            value: 'https://planetclick.click/',
            category: 'urls',
            description: 'Main sales page URL'
        },
        {
            key: 'stickerLabProduct',
            value: {
                name: 'StickerLab',
                url: 'https://warriorplus.com/o2/buy/jvrcjg/l3lbqv/svyh7b',
                productId: 'wso_svyh7b'
            },
            category: 'products',
            description: 'Main StickerLab product'
        },
        {
            key: 'unlimitedProduct',
            value: {
                name: 'StickerLab Unlimited',
                url: 'https://warriorplus.com/o2/buy/qz974/ts93t4/kwc43t',
                productId: 'wso_kwc43t'
            },
            category: 'products',
            description: 'StickerLab Unlimited product'
        },
        {
            key: 'products',
            value: [
                {
                    name: 'StickerLab',
                    url: 'https://warriorplus.com/o2/buy/jvrcjg/l3lbqv/svyh7b',
                    productId: 'wso_svyh7b'
                },
                {
                    name: 'StickerLab Unlimited',
                    url: 'https://warriorplus.com/o2/buy/qz974/ts93t4/kwc43t',
                    productId: 'wso_kwc43t'
                }
            ],
            category: 'products',
            description: 'List of all products'
        },
        {
            key: 'creditProducts',
            value: [
                {
                    credits: 100,
                    productId: 'wso_h0pdbg',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/vdcb4x/h0pdbg'
                }
            ],
            category: 'products',
            description: 'Credit packages available for purchase'
        }
    ];

    try {
        for (const variable of defaultVariables) {
            await Variable.findOneAndUpdate(
                { key: variable.key },
                { $setOnInsert: variable },
                { upsert: true }
            );
        }
        console.log('Variables initialized successfully');
    } catch (error) {
        console.error('Error initializing variable:', error);
    }
}

export default router;
