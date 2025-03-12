import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/register', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, name } = req.body;
        console.log('Registration attempt for email:', email);

        // Check if the email was used to purchase StickerLab
        const stickerLabPurchase = await User.findOne({ email: email });
        console.log('Found user:', stickerLabPurchase);
        
        let initialCredits = 0; // Default credits for new users
        let creditHistory = [];

        if (stickerLabPurchase) {
            console.log('User credit history:', stickerLabPurchase.creditHistory);
            // Check if user has StickerLab purchase
            const hasStickerLab = stickerLabPurchase.creditHistory?.some(h => h.product === 'StickerLab');
            console.log('Has StickerLab purchase:', hasStickerLab);

            if (hasStickerLab) {
                // User exists and has StickerLab, update their info
                console.log('Updating existing user');
                stickerLabPurchase.name = name;
                stickerLabPurchase.password = password; // This will trigger the password hashing middleware
                stickerLabPurchase.registered = true; // Mark as registered
                await stickerLabPurchase.save();
                
                const token = jwt.sign({ userId: stickerLabPurchase._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
                });
                return res.status(200).json({ user: { id: stickerLabPurchase._id, email: stickerLabPurchase.email, name: stickerLabPurchase.name } });
            }
        }

        // Create new user with initial credits
        console.log('Creating new user with initial credits:', initialCredits);
        creditHistory.push({
            product: 'Initial Credits',
            purchasedAt: new Date(),
            credits: initialCredits
        });

        let user = new User({ 
            email, 
            password, 
            name,
            credits: initialCredits,
            creditHistory: creditHistory,
            registered: true
        });
        await user.save();
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.status(201).json({ user: { id: user._id, email: user.email, name: user.name } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login route
router.post('/login', [
    body('email').isEmail(),
    body('password').exists()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check if user has a password set (in case they haven't completed registration)
        if (!user.password) {
            return res.status(401).json({ error: 'Please complete registration first' });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create and set JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Update last login timestamp
        user.lastLogin = new Date();
        await user.save();

        // Return user data (excluding password)
        res.json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                credits: user.credits,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        // User is already attached to req by auth middleware
        res.json({ 
            user: {
                id: req.user._id,
                email: req.user.email,
                name: req.user.name,
                credits: req.user.credits
            }
        });
    } catch (error) {
        console.error('Error getting user data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user info (both /me and /user for compatibility)
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Auth check endpoint
router.get('/check', auth, (req, res) => {
    res.status(200).json({ 
        user: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name
        }
    });
});

// Create or update admin user
router.post('/create-admin', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Check if admin exists
        let admin = await User.findOne({ role: 'admin' });
        
        if (admin) {
            // Update existing admin
            admin.email = email;
            admin.name = name;
            if (password) {
                admin.password = password; // Will be hashed by the User model middleware
            }
            await admin.save();

            const token = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            return res.status(200).json({
                message: 'Admin user updated successfully',
                user: {
                    id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                }
            });
        }

        // Create new admin user if none exists
        admin = new User({
            email,
            password,
            name,
            role: 'admin',
            credits: 1000,
            registered: true,
            subscription: {
                plan: 'free',
                status: 'active'
            },
            creditHistory: [{
                product: 'AdminAccount',
                credits: 1000,
                date: new Date(),
                transactionId: 'INITIAL_ADMIN'
            }],
            usage: {
                imagesGenerated: 0,
                savedPresets: 0
            },
            createdAt: new Date(),
            lastLogin: new Date()
        });

        await admin.save();
        
        // Create and set token
        const token = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({
            message: 'Admin user created successfully',
            user: {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('Error creating/updating admin:', error);
        res.status(500).json({ error: 'Failed to create/update admin user' });
    }
});

export default router;
