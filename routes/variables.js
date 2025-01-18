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
            key: 'creditProducts',
            value: [
                {
                    credits: 100,
                    productId: 'wso_h0pdbg',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/vdcb4x/h0pdbg'
                },
                {
                    credits: 200,
                    productId: 'wso_g9brry',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/yhq5m5/g9brry'
                },
                {
                    credits: 300,
                    productId: 'wso_z073wm',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/bt8zt6/z073wm'
                },
                {
                    credits: 400,
                    productId: 'wso_k6bx56',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/xww2bb/k6bx56'
                },
                {
                    credits: 500,
                    productId: 'wso_mnn103',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/lzyt7t/mnn103'
                },
                {
                    credits: 600,
                    productId: 'wso_p6t554',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/p6ww4z/p6t554'
                },
                {
                    credits: 700,
                    productId: 'wso_pc7kvg',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/wrsc7x/pc7kvg'
                },
                {
                    credits: 800,
                    productId: 'wso_lzd4gh',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/p5x9b0/lzd4gh'
                },
                {
                    credits: 900,
                    productId: 'wso_yhcpx7',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/lm6xrs/yhcpx7'
                },
                {
                    credits: 1000,
                    productId: 'wso_n7w5lr',
                    purchaseUrl: 'https://warriorplus.com/o2/buy/jvrcjg/kbnt1j/n7w5lr'
                }
            ],
            category: 'credits',
            description: 'Credit package products'
        }
    ];

    try {
        for (const variable of defaultVariables) {
            await Variable.findOneAndUpdate(
                { key: variable.key },
                variable,
                { upsert: true, new: true }
            );
        }
        console.log('Variables initialized successfully');
    } catch (error) {
        console.error('Error initializing variable:', error);
    }
}

export default router;
